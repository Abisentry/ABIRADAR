import { store } from "./store/index.js";

export const emptyStats = () => ({
  total: 0,
  new: 0,
  inProgress: 0,
  done: 0,
  notApplicable: 0,
  open: 0,
  critical: 0,
});

export function tally(deliveries) {
  const s = emptyStats();
  for (const d of deliveries) {
    s.total++;
    if (d.status === "new") s.new++;
    else if (d.status === "in_progress") s.inProgress++;
    else if (d.status === "done") s.done++;
    else s.notApplicable++;
    if (["new", "in_progress"].includes(d.status) && !d.withdrawn) {
      s.open++;
      if (d.severity === "critical") s.critical++;
    }
  }
  return s;
}
export const sumStats = (list) =>
  list.reduce((a, s) => {
    for (const k of Object.keys(a)) a[k] += s?.[k] || 0;
    return a;
  }, emptyStats());

export const recountOrg = async (orgId) =>
  store.update("organisations", orgId, {
    stats: tally(await store.find("deliveries", { where: { orgId } })),
  });
export const recountAlert = async (alertId) =>
  store.update("alerts", alertId, {
    stats: tally(await store.find("deliveries", { where: { alertId } })),
  });
