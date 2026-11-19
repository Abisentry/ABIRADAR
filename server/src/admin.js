import { Router } from "express";
import { store, newId } from "./store/index.js";
import { requireAuth, requireVerified } from "./auth.js";
import { isAdmin,
    iso, 
    mailAll
   } from "./util.js";
import {
  decisionSchema,
  composeSchema,
  entrySchema,
  postSchema,
  incidentDecisionSchema
} from "./validate.js";
import { sendDecision } from "./mailer.js";
import { collectRecipients, dispatchAlertEmails } from "./alertEmails.js";
import { deliveryOut } from "./alertView.js";
import { emptyStats, sumStats, recountOrg, recountAlert } from "./stats.js";

// Platform owner only. Everything here spans all institutions.
const router = Router();
router.use(requireAuth, requireVerified, (req, res, next) =>
  isAdmin(req.user.email)
    ? next()
    : res.status(403).json({ error: "Not allowed." }),
);

const byNewest = (a, b) => b.createdAt - a.createdAt;
const allOrgs = () =>
  store.find("organisations", { orderBy: ["createdAt", "desc"] });
const orgOut = (o) => ({
  id: o.id,
  name: o.name,
  type: o.type,
  size: o.size,
  country: o.country,
  status: o.status,
  reviewNote: o.reviewNote,
  reviewedAt: iso(o.reviewedAt),
  createdAt: iso(o.createdAt),
  profile: o.profile,
  owner: { fullName: o.ownerName, email: o.ownerEmail },
});
const alertOut = (a) => ({
  id: a.id,
  title: a.title,
  severity: a.severity,
  summary: a.summary,
  actions: a.actions,
  threat: a.threat || null,
  audience: a.audience,
  withdrawn: !!a.withdrawnAt,
  sentAt: iso(a.createdAt),
  sentBy: a.sender || "Former admin",
  stats: a.stats || emptyStats(),
});

router.get("/overview", async (_req, res) => {
  const orgs = await allOrgs();
  const n = (s) => orgs.filter((o) => o.status === s).length;
  res.json({
    institutions: {
      total: orgs.length,
      pending: n("pending"),
      approved: n("approved"),
      rejected: n("rejected"),
    },
    people: await store.count("members"),
    alertsSent: await store.count("alerts"),
    responses: sumStats(orgs.map((o) => o.stats)),
    newReports: await store.count("incidentReports", { status: "new" }),
    pending: orgs
      .filter((o) => o.status === "pending")
      .reverse()
      .slice(0, 5)
      .map(orgOut),
    recentAlerts: (
      await store.find("alerts", { orderBy: ["createdAt", "desc"], limit: 5 })
    ).map(alertOut),
  });
});

router.get("/organisations", async (req, res) => {
  const orgs = await allOrgs();
  const status = String(req.query.status || "all");
  const shown = ["pending", "approved", "rejected"].includes(status)
    ? orgs.filter((o) => o.status === status)
    : orgs;
  shown.sort((a, b) => (b.status === "pending") - (a.status === "pending")); // stable: pending first, newest first within
  const n = (s) => orgs.filter((o) => o.status === s).length;
  const pageSize = Math.min(
    Math.max(parseInt(req.query.pageSize, 10) || 20, 1),
    100,
  );
  const pages = Math.max(1, Math.ceil(shown.length / pageSize));
  const page = Math.min(Math.max(parseInt(req.query.page, 10) || 1, 1), pages); // a page that does not exist gives the nearest one that does
  res.json({
    counts: {
      pending: n("pending"),
      approved: n("approved"),
      rejected: n("rejected"),
      all: orgs.length,
    },
    page,
    pageSize,
    pages,
    total: shown.length,
    organisations: shown
      .slice((page - 1) * pageSize, page * pageSize)
      .map((o) => ({
        ...orgOut(o),
        teamSize: o.teamSize || 1,
        alerts: o.stats || emptyStats(),
      })),
  });
});

// Every approved institution, not paged. Used to choose who receives an alert.
router.get("/institution-options", async (_req, res) => {
  const approved = (await allOrgs()).filter((o) => o.status === "approved");
  res.json({
    institutions: approved
      .map((o) => ({ id: o.id, name: o.name, type: o.type }))
      .sort((a, b) => a.name.localeCompare(b.name)),
  });
});

router.get("/organisations/:id", async (req, res) => {
  const o = await store.get("organisations", req.params.id);
  if (!o) return res.status(404).json({ error: "Institution not found." });
  const members = (
    await store.find("members", { where: { orgId: o.id } })
  ).sort((a, b) => a.createdAt - b.createdAt);
  const invites = (
    await store.find("invitations", { where: { orgId: o.id } })
  ).filter((i) => !i.acceptedAt && i.expiresAt > new Date());
  res.json({
    ...orgOut(o),
    team: members.map((m) => ({
      id: m.id,
      fullName: m.userName,
      email: m.userEmail,
      role: m.role,
      joinedAt: iso(m.createdAt),
    })),
    invitations: invites.map((i) => ({
      email: i.email,
      role: i.role,
      invitedAt: iso(i.createdAt),
    })),
    alertStats: o.stats || emptyStats(),
    alerts: (
      await store.find("deliveries", {
        where: { orgId: o.id },
        orderBy: ["sentAt", "desc"],
        limit: 50,
      })
    ).map(deliveryOut),
  });
});

router.post("/organisations/:id/decision", async (req, res) => {
  const parsed = decisionSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const o = await store.get("organisations", req.params.id);
  if (!o) return res.status(404).json({ error: "Institution not found." });
  await store.update("organisations", o.id, {
    status: parsed.data.decision,
    reviewNote: parsed.data.note || null,
    reviewedAt: new Date(),
  });
  await mailAll(
    "Decision email",
    sendDecision({
      user: { fullName: o.ownerName, email: o.ownerEmail },
      org: o.name,
      decision: parsed.data.decision,
      note: parsed.data.note,
    }),
  );
  res.json({ ok: true });
});

// ---------- Alerts the owner sends ----------

const matches = (aud, o) =>
  aud.mode === "all" ||
  (aud.mode === "types"
    ? aud.types.includes(o.type)
    : aud.orgIds.includes(o.id));

router.post("/alerts", async (req, res) => {
  const parsed = composeSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const d = parsed.data;
  // Only approved institutions can receive alerts.
  const targets = (await allOrgs()).filter(
    (o) => o.status === "approved" && matches(d.audience, o),
  );
  if (!targets.length)
    return res
      .status(400)
      .json({ error: "No approved institution matches this audience." });

  const alertId = newId(),
    now = new Date();
  const critical = d.severity === "critical" ? 1 : 0;
  await store.set("alerts", alertId, {
    title: d.title,
    severity: d.severity,
    summary: d.summary,
    actions: d.actions,
    threat: d.threat || null,
    audience: d.audience,
    createdBy: req.user.id,
    sender: req.user.fullName,
    withdrawnAt: null,
    createdAt: now,
    stats: {
      ...emptyStats(),
      total: targets.length,
      new: targets.length,
      open: targets.length,
      critical: critical * targets.length,
    },
  });

  // A copy of the alert goes to each institution, so listing an institution's alerts needs no joins.
  const ops = [];
  for (const o of targets) {
    ops.push({
      type: "set",
      col: "deliveries",
      id: `${alertId}_${o.id}`,
      data: {
        alertId,
        orgId: o.id,
        orgName: o.name,
        status: "new",
        history: [],
        title: d.title,
        severity: d.severity,
        summary: d.summary,
        actions: d.actions,
        threat: d.threat || null,
        withdrawn: false,
        sentAt: now,
        createdAt: now,
        updatedAt: now,
      },
    });
    const s = o.stats || emptyStats();
    ops.push({
      type: "update",
      col: "organisations",
      id: o.id,
      data: {
        stats: {
          ...s,
          total: s.total + 1,
          new: s.new + 1,
          open: s.open + 1,
          critical: s.critical + critical,
        },
      },
    });
  }
  await store.batch(ops);

  // Email the owners, admins and analysts of each institution, following their saved preferences.
  const wanted = await collectRecipients(d, targets);
  await dispatchAlertEmails(alertId, d, wanted); // sends after replying, or hands off to a background function on Netlify
  res
    .status(201)
    .json({ id: alertId, delivered: targets.length, emailed: wanted.length });
});

router.get("/alerts", async (req, res) => {
  const severity = String(req.query.severity || "all");
  let rows = await store.find("alerts", {
    orderBy: ["createdAt", "desc"],
    limit: 200,
  });
  if (["critical", "warning", "info"].includes(severity))
    rows = rows.filter((a) => a.severity === severity);
  res.json({ alerts: rows.slice(0, 100).map(alertOut) });
});

router.get("/alerts/:id", async (req, res) => {
  const a = await store.get("alerts", req.params.id);
  if (!a) return res.status(404).json({ error: "Alert not found." });
  const rank = { new: 0, in_progress: 1, done: 2, not_applicable: 3 };
  const rows = (
    await store.find("deliveries", { where: { alertId: a.id } })
  ).sort(
    (x, y) =>
      rank[x.status] - rank[y.status] || x.orgName.localeCompare(y.orgName),
  );
  res.json({
    ...alertOut(a),
    deliveries: rows.map((d) => ({
      id: d.id,
      orgId: d.orgId,
      orgName: d.orgName,
      status: d.status,
      updatedAt: iso(d.updatedAt),
      history: deliveryOut(d).history,
    })),
  });
});

router.post("/alerts/:id/withdraw", async (req, res) => {
  const a = await store.get("alerts", req.params.id);
  if (!a || a.withdrawnAt)
    return res
      .status(404)
      .json({ error: "Alert not found, or already withdrawn." });
  await store.update("alerts", a.id, { withdrawnAt: new Date() });
  const rows = await store.find("deliveries", { where: { alertId: a.id } });
  await store.batch(
    rows.map((d) => ({
      type: "update",
      col: "deliveries",
      id: d.id,
      data: { withdrawn: true },
    })),
  );
  await recountAlert(a.id);
  await Promise.all([...new Set(rows.map((d) => d.orgId))].map(recountOrg));
  res.json({ ok: true });
});

// ---------- Fraud library and playbooks ----------

const entryOut = (e) => ({
  id: e.id,
  name: e.name,
  summary: e.summary,
  signs: e.signs,
  steps: e.steps,
  published: e.published,
  sort: e.sort,
});
const nameTaken = async (name, exceptId) =>
  (await store.find("fraudEntries", { where: { name } })).some(
    (e) => e.id !== exceptId,
  );

router.get("/library", async (_req, res) =>
  res.json({
    entries: (
      await store.find("fraudEntries", { orderBy: ["sort", "asc"] })
    ).map(entryOut),
  }),
);

router.post("/library", async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  if (await nameTaken(parsed.data.name))
    return res
      .status(409)
      .json({ error: "There is already an entry with that name." });
  const id = newId();
  await store.set("fraudEntries", id, {
    ...parsed.data,
    updatedAt: new Date(),
  });
  res.status(201).json({ id });
});

router.put("/library/:id", async (req, res) => {
  const parsed = entrySchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  if (!(await store.get("fraudEntries", req.params.id)))
    return res.status(404).json({ error: "Entry not found." });
  if (await nameTaken(parsed.data.name, req.params.id))
    return res
      .status(409)
      .json({ error: "There is already an entry with that name." });
  await store.update("fraudEntries", req.params.id, {
    ...parsed.data,
    updatedAt: new Date(),
  });
  res.json({ ok: true });
});

router.delete("/library/:id", async (req, res) => {
  if (!(await store.get("fraudEntries", req.params.id)))
    return res.status(404).json({ error: "Entry not found." });
  await store.delete("fraudEntries", req.params.id);
  res.json({ ok: true });
});

// ---------- Reviews and community advisories ----------

const postOut = (p) => ({
  id: p.id,
  kind: p.kind,
  title: p.title,
  period: p.period || null,
  cadence: p.cadence || null,
  body: p.body,
  audience: p.audience || [],
  published: p.published,
  publishedAt: iso(p.publishedAt),
  createdAt: iso(p.createdAt),
});

router.get("/posts", async (req, res) => {
  const kind = req.query.kind === "community" ? "community" : "review";
  res.json({
    posts: (await store.find("posts", { where: { kind } }))
      .sort(byNewest)
      .map(postOut),
  });
});

router.post("/posts", async (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const id = newId(),
    now = new Date();
  await store.set("posts", id, {
    ...parsed.data,
    period: parsed.data.period || null,
    cadence: parsed.data.cadence || null,
    publishedAt: parsed.data.published ? now : null,
    authorId: req.user.id,
    createdAt: now,
    updatedAt: now,
  });
  res.status(201).json({ id });
});

router.put("/posts/:id", async (req, res) => {
  const parsed = postSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const p = await store.get("posts", req.params.id);
  if (!p) return res.status(404).json({ error: "Post not found." });
  const now = new Date();
  await store.update("posts", p.id, {
    ...parsed.data,
    period: parsed.data.period || null,
    cadence: parsed.data.cadence || null,
    publishedAt: parsed.data.published ? p.publishedAt || now : null,
    updatedAt: now,
  });
  res.json({ ok: true });
});

router.delete("/posts/:id", async (req, res) => {
  if (!(await store.get("posts", req.params.id)))
    return res.status(404).json({ error: "Post not found." });
  await store.delete("posts", req.params.id);
  res.json({ ok: true });
});

// ---------- Reports institutions send in ----------

const incidentOut = (r) => ({
  id: r.id,
  title: r.title,
  details: r.details,
  anonymous: r.anonymous,
  status: r.status,
  reviewNote: r.reviewNote,
  createdAt: iso(r.createdAt),
  orgId: r.orgId,
  orgName: r.orgName,
  orgType: r.orgType,
  by: r.userName,
});

router.get("/incident-reports", async (req, res) => {
  const status = String(req.query.status || "new");
  let rows = await store.find("incidentReports", {
    orderBy: ["createdAt", "desc"],
    limit: 200,
  });
  if (["new", "reviewed", "dismissed"].includes(status))
    rows = rows.filter((r) => r.status === status);
  res.json({
    reports: rows.map(incidentOut),
    newCount: await store.count("incidentReports", { status: "new" }),
  });
});

router.patch("/incident-reports/:id", async (req, res) => {
  const parsed = incidentDecisionSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  if (!(await store.get("incidentReports", req.params.id)))
    return res.status(404).json({ error: "Report not found." });
  await store.update("incidentReports", req.params.id, {
    status: parsed.data.status,
    reviewNote: parsed.data.note || null,
  });
  res.json({ ok: true });
});


export default router;
