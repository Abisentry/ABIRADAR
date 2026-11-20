import fs from "node:fs";
import path from "node:path";
import { plan } from "../../../convex/indexes.js";

// A small in-memory database that follows Firestore's rules (equality filters, one ordering, reads before writes
// in a transaction, indexes required). With `file` it is saved to disk, which is what local development uses.
const cmp = (a, b) => {
  if (a instanceof Date) a = a.getTime();
  if (b instanceof Date) b = b.getTime();
  if (a === b) return 0;
  if (a === null) return -1;
  if (b === null) return 1;
  return a < b ? -1 : 1;
};
const strip = (v) => {
  if (v instanceof Date) return v;
  if (Array.isArray(v)) return v.map(strip);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, strip(x)]),
    );
  return v;
};
// Refuses any query that no index in convex/indexes.js could answer, so a query that works here also works on Convex.
function assertIndexed(col, where, orderBy) {
  const keys = Object.keys(where);
  if ((keys.length || orderBy) && !plan(col, keys, orderBy?.[0]))
    throw new Error(
      `No index for ${col}(${keys.join(", ")}${orderBy ? " order by " + orderBy[0] : ""}). Add one in convex/indexes.js`,
    );
}
const notFound = (w) =>
  Object.assign(new Error(`NOT_FOUND: ${w.col}/${w.id}`), { code: 5 });

export function createMemoryStore({ file } = {}) {
  const cols = new Map();
  const col = (n) => {
    if (!cols.has(n)) cols.set(n, new Map());
    return cols.get(n);
  };

  if (file && fs.existsSync(file)) {
    const raw = JSON.parse(fs.readFileSync(file, "utf8"), (k, v) =>
      v && typeof v === "object" && v.$date ? new Date(v.$date) : v,
    );
    for (const [n, docs] of Object.entries(raw))
      cols.set(n, new Map(Object.entries(docs)));
  }
  let timer;
  function save() {
    const out = {};
    for (const [n, m] of cols) out[n] = Object.fromEntries(m);
    const text = JSON.stringify(out, function (k, v) {
      const r = this[k];
      return r instanceof Date ? { $date: r.toISOString() } : v;
    });
    try {
      fs.mkdirSync(path.dirname(file), { recursive: true });
      try {
        fs.writeFileSync(file + ".tmp", text);
        fs.renameSync(file + ".tmp", file);
      } catch {
        fs.writeFileSync(file, text);
      } // Windows can refuse the rename while OneDrive or antivirus holds the file
    } catch (e) {
      console.error(
        `Could not save ${file} (${e.code || e.message}). Trying again in a moment. Is the folder inside OneDrive?`,
      );
      clearTimeout(timer);
      timer = setTimeout(save, 2000);
      timer.unref?.(); // never crash the server over a locked file
    }
  }
  const persist = () => {
    if (file) {
      clearTimeout(timer);
      timer = setTimeout(save, 100);
      timer.unref?.();
    }
  };
  if (file) {
    process.on("exit", () => {
      try {
        save();
      } catch {
        /* nothing more to do */
      }
    });
    for (const sig of ["SIGINT", "SIGTERM"])
      process.on(sig, () => process.exit(0));
  }

  const get = (c, id) => {
    const d = col(c).get(id);
    return d === undefined ? null : { id, ...structuredClone(d) };
  };
  function find(c, { where = {}, orderBy, limit } = {}) {
    assertIndexed(c, where, orderBy);
    let rows = [...col(c)].filter(([, d]) =>
      Object.entries(where).every(([k, v]) => d[k] === v),
    );
    if (orderBy) {
      const [f, dir] = orderBy;
      rows = rows
        .filter(([, d]) => d[f] !== undefined)
        .sort(
          (a, b) =>
            cmp(a[1][f], b[1][f]) * (dir === "desc" ? -1 : 1) ||
            (a[0] < b[0] ? -1 : 1),
        );
    } else rows.sort((a, b) => (a[0] < b[0] ? -1 : 1)); // Firestore's default order is by document id
    if (limit) rows = rows.slice(0, limit);
    return rows.map(([id, d]) => ({ id, ...structuredClone(d) }));
  }
  function apply(writes) {
    for (const w of writes)
      if (w.type === "update" && !col(w.col).has(w.id)) throw notFound(w);
    for (const w of writes) {
      const m = col(w.col);
      if (w.type === "set") m.set(w.id, strip(w.data));
      else if (w.type === "update")
        m.set(w.id, { ...m.get(w.id), ...strip(w.data) });
      else m.delete(w.id);
    }
    persist();
  }

  let lock = Promise.resolve();
  function tx(fn) {
    const run = lock.then(async () => {
      const writes = [];
      const noReadAfterWrite = () => {
        if (writes.length)
          throw new Error(
            "Firestore transactions must do all reads before any writes",
          );
      };
      const out = await fn({
        get: async (c, id) => {
          noReadAfterWrite();
          return get(c, id);
        },
        find: async (c, o) => {
          noReadAfterWrite();
          return find(c, o);
        },
        set: (c, id, data) => writes.push({ type: "set", col: c, id, data }),
        update: (c, id, data) =>
          writes.push({ type: "update", col: c, id, data }),
        delete: (c, id) => writes.push({ type: "delete", col: c, id }),
      });
      apply(writes);
      return out;
    });
    lock = run.catch(() => {});
    return run;
  }

  return {
    kind: file ? "file" : "memory",
    get: async (c, id) => get(c, id),
    find: async (c, o) => find(c, o),
    count: async (c, where = {}) => find(c, { where }).length,
    set: async (c, id, data) => apply([{ type: "set", col: c, id, data }]),
    update: async (c, id, data) =>
      apply([{ type: "update", col: c, id, data }]),
    delete: async (c, id) => apply([{ type: "delete", col: c, id }]),
    batch: async (ops) =>
      apply(
        ops.map((o) => ({ type: o.type, col: o.col, id: o.id, data: o.data })),
      ),
    tx,
  };
}
