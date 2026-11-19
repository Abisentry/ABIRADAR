import { iso } from "./util.js";

// One institution's copy of an alert: the alert itself plus how that institution is responding.
export const deliveryOut = (d) => ({
  id: d.id,
  alertId: d.alertId,
  title: d.title,
  severity: d.severity,
  summary: d.summary,
  actions: d.actions,
  threat: d.threat || null,
  status: d.status,
  withdrawn: !!d.withdrawn,
  sentAt: iso(d.sentAt),
  updatedAt: iso(d.updatedAt),
  history: (d.history || []).map((h) => ({
    by: h.by,
    status: h.status,
    note: h.note || null,
    at: iso(h.at),
  })),
});
