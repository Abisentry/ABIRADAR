import { ConvexHttpClient } from "convex/browser";
import { anyApi } from "convex/server";

// Convex has no Date type, so dates are stored as numbers and turned back into Dates by field name.
const DATE_FIELDS = new Set([
  "createdAt",
  "updatedAt",
  "sentAt",
  "expiresAt",
  "usedAt",
  "consumedAt",
  "lastSentAt",
  "verifiedAt",
  "acceptedAt",
  "emailVerifiedAt",
  "lockedUntil",
  "reviewedAt",
  "withdrawnAt",
  "publishedAt",
  "at",
]);
const enc = (v) => {
  if (v instanceof Date) return v.getTime();
  if (Array.isArray(v)) return v.map(enc);
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v)
        .filter(([, x]) => x !== undefined)
        .map(([k, x]) => [k, enc(x)]),
    );
  return v;
};
const dec = (v, key) => {
  if (Array.isArray(v)) return v.map((x) => dec(x, key));
  if (v && typeof v === "object")
    return Object.fromEntries(
      Object.entries(v).map(([k, x]) => [k, dec(x, k)]),
    );
  return DATE_FIELDS.has(key) && typeof v === "number" ? new Date(v) : v;
};
const shape = (r) => {
  const { docId, ver, ...rest } = r;
  return { id: docId, ...dec(rest) };
};

export function createConvexStore({
  url = process.env.CONVEX_URL,
  secret = process.env.STORE_SECRET,
} = {}) {
  if (!url || !secret)
    throw new Error("Set CONVEX_URL and STORE_SECRET (see DEPLOY.md)");
  // A fresh client each time: one client queues its mutations, and a server handles many requests at once.
  const client = () =>
    new ConvexHttpClient(url, {
      logger: false,
      skipConvexDeploymentUrlCheck: true,
    });
  const read = (fn, args) => client().query(fn, { secret, ...args });
  const write = (ops, reads) =>
    client().mutation(anyApi.store.apply, {
      secret,
      ops: ops.map((o) => ({
        ...o,
        data: o.data === undefined ? undefined : enc(o.data),
      })),
      reads,
    });
  const find = async (col, { where = {}, orderBy, limit } = {}) =>
    (
      await read(anyApi.store.find, { col, where: enc(where), orderBy, limit })
    ).map(shape);

  return {
    kind: "convex",
    get: async (col, id) => {
      const r = await read(anyApi.store.get, { col, id });
      return r ? shape(r) : null;
    },
    find,
    count: (col, where = {}) =>
      read(anyApi.store.count, { col, where: enc(where) }),
    set: async (col, id, data) => {
      await write([{ type: "set", col, id, data }]);
    },
    update: async (col, id, data) => {
      await write([{ type: "update", col, id, data }]);
    },
    delete: async (col, id) => {
      await write([{ type: "delete", col, id }]);
    },
    // Large sets are sent in pieces, each all-or-nothing.
    async batch(ops) {
      for (let i = 0; i < ops.length; i += 300)
        await write(
          ops
            .slice(i, i + 300)
            .map(({ type, col, id, data }) => ({ type, col, id, data })),
        );
    },
    rateHit: (key, windowMs) =>
      client().mutation(anyApi.rate.hit, { secret, key, windowMs }),

    // Reads are remembered with the version they had. When the writes are sent, Convex refuses them if any of those
    // documents changed in the meantime, and the whole function runs again on fresh data.
    async tx(fn) {
      for (let attempt = 0; attempt < 5; attempt++) {
        const reads = new Map(),
          writes = [];
        const noReadAfterWrite = () => {
          if (writes.length)
            throw new Error("Transactions must do all reads before any writes");
        };
        const out = await fn({
          get: async (col, id) => {
            noReadAfterWrite();
            const r = await read(anyApi.store.get, { col, id });
            reads.set(`${col}/${id}`, { col, id, ver: r ? r.ver : 0 });
            return r ? shape(r) : null;
          },
          find: async (col, o) => {
            noReadAfterWrite();
            return find(col, o);
          },
          set: (col, id, data) => writes.push({ type: "set", col, id, data }),
          update: (col, id, data) =>
            writes.push({ type: "update", col, id, data }),
          delete: (col, id) => writes.push({ type: "delete", col, id }),
        });
        if ((await write(writes, [...reads.values()])).ok) return out;
      }
      throw new Error(
        "Too many people changed this at once. Please try again.",
      );
    },
  };
}
