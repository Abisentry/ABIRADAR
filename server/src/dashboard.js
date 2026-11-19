import { Router } from "express";
import { store, newId } from "./store/index.js";
import { requireAuth, requireVerified } from "./auth.js";
import { withOrg, need, can } from "./access.js";
import { deliveryOut } from "./alertView.js";
import { statusSchema, incidentSchema } from "./validate.js";
import { recountOrg, recountAlert, emptyStats } from "./stats.js";
import { buildReport, readiness } from "./reports.js";
import { iso } from "./util.js";

// Everything an institution sees. Every query is scoped to the caller's own institution.
const router = Router();
router.use(requireAuth, requireVerified);
router.use(withOrg);

const isOpen = (d) => ["new", "in_progress"].includes(d.status) && !d.withdrawn;
const myDeliveries = (orgId, limit) =>
  store.find("deliveries", {
    where: { orgId },
    orderBy: ["sentAt", "desc"],
    limit,
  });

router.get("/overview", async (req, res) => {
  if (!can(req.org.role, "alerts:view"))
    return res.json({
      received: null,
      openAlerts: null,
      criticalOpen: null,
      recent: [],
    });
  const s = req.org.stats || emptyStats();
  res.json({
    received: s.total,
    openAlerts: s.open,
    criticalOpen: s.critical,
    recent: (await myDeliveries(req.org.id, 5)).map(deliveryOut),
  });
});

router.get("/alerts", need("alerts:view"), async (req, res) => {
  const status = String(req.query.status || "open"),
    severity = String(req.query.severity || "all");
  let rows = await myDeliveries(req.org.id, 300);
  if (status === "open") rows = rows.filter(isOpen);
  else if (["new", "in_progress", "done", "not_applicable"].includes(status))
    rows = rows.filter((d) => d.status === status);
  if (["critical", "warning", "info"].includes(severity))
    rows = rows.filter((d) => d.severity === severity);
  const s = req.org.stats || emptyStats();
  res.json({
    alerts: rows.slice(0, 100).map(deliveryOut),
    counts: { received: s.total, open: s.open, critical: s.critical },
  });
});

// :id is this institution's delivery of the alert.
router.patch("/alerts/:id", need("alerts:handle"), async (req, res) => {
  const parsed = statusSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const out = await store.tx(async (t) => {
    const d = await t.get("deliveries", req.params.id);
    if (!d || d.orgId !== req.org.id) return { code: 404 };
    if (d.withdrawn) return { code: 409 };
    const now = new Date();
    t.update("deliveries", d.id, {
      status: parsed.data.status,
      updatedAt: now,
      history: [
        ...(d.history || []),
        {
          by: req.user.fullName,
          status: parsed.data.status,
          note: parsed.data.note || null,
          at: now,
        },
      ],
    });
    return { code: 200, alertId: d.alertId };
  });
  if (out.code === 404)
    return res.status(404).json({ error: "Alert not found." });
  if (out.code === 409)
    return res.status(409).json({
      error: "This alert was withdrawn, so it can no longer be changed.",
    });
  await recountOrg(req.org.id);
  await recountAlert(out.alertId);
  res.json({ ok: true });
});

// ---- Fraud library and playbooks (the owner edits these) ----
router.get("/library", async (_req, res) => {
  const rows = (
    await store.find("fraudEntries", { orderBy: ["sort", "asc"] })
  ).filter((e) => e.published);
  res.json({
    entries: rows.map((e) => ({
      id: e.id,
      name: e.name,
      summary: e.summary,
      signs: e.signs,
      steps: e.steps,
    })),
  });
});

// ---- Reviews and community advisories the owner publishes ----
router.get("/posts", async (req, res) => {
  const kind = req.query.kind === "community" ? "community" : "review";
  const rows = (await store.find("posts", { where: { kind, published: true } }))
    .filter((p) => !p.audience?.length || p.audience.includes(req.org.type))
    .sort((a, b) => b.publishedAt - a.publishedAt)
    .slice(0, 50);
  res.json({
    posts: rows.map((p) => ({
      id: p.id,
      title: p.title,
      period: p.period || null,
      cadence: p.cadence || null,
      body: p.body,
      publishedAt: iso(p.publishedAt),
    })),
  });
});

// ---- The institution's own weekly or monthly report, and its readiness score ----
router.get("/reports/summary", need("alerts:view"), async (req, res) => {
  const cadence = req.query.cadence === "monthly" ? "monthly" : "weekly";
  const offset = Math.min(Math.max(parseInt(req.query.offset, 10) || 0, 0), 11);
  res.json(await buildReport(req.org.id, cadence, offset));
});
router.get("/readiness", need("alerts:view"), async (req, res) =>
  res.json(await readiness(req.org.id)),
);

// ---- Community reporting: an institution tells the owner about a fraud attempt ----
router.post("/community/reports", need("alerts:handle"), async (req, res) => {
  const parsed = incidentSchema.safeParse(req.body);
  if (!parsed.success)
    return res.status(400).json({ error: parsed.error.issues[0].message });
  const id = newId();
  await store.set("incidentReports", id, {
    orgId: req.org.id,
    orgName: req.org.name,
    orgType: req.org.type,
    userId: req.user.id,
    userName: req.user.fullName,
    title: parsed.data.title,
    details: parsed.data.details,
    anonymous: parsed.data.anonymous,
    status: "new",
    reviewNote: null,
    createdAt: new Date(),
  });
  res.status(201).json({ id });
});

router.get("/community/reports", need("alerts:view"), async (req, res) => {
  const rows = (
    await store.find("incidentReports", { where: { orgId: req.org.id } })
  )
    .sort((a, b) => b.createdAt - a.createdAt)
    .slice(0, 50);
  res.json({
    reports: rows.map((r) => ({
      id: r.id,
      title: r.title,
      details: r.details,
      anonymous: r.anonymous,
      status: r.status,
      reviewNote: r.reviewNote,
      createdAt: iso(r.createdAt),
    })),
  });
});

export default router;
