import { useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { PageTitle, Card } from "./ui.jsx";
import { api } from "../lib/api.js";
import { usePoll } from "../lib/usePoll.js";
import { steps } from "../data/questions.js";

const TYPES = steps
  .find((s) => s.id === "org")
  .fields.find((f) => f.name === "orgType")
  .options.map((o) => o.value);
const lines = (t) =>
  t
    .split("\n")
    .map((s) => s.trim())
    .filter(Boolean);

export default function AdminAlertNew() {
  const prefill = useLocation().state || {}; // set when starting from a report an institution sent
  const [f, setF] = useState({
    title: prefill.title || "",
    severity: "warning",
    summary: prefill.summary || "",
    actions: "",
    threat: "",
    mode: "all",
    types: [],
    orgIds: [],
  });
  const [library, setLibrary] = useState([]);
  const [orgs, setOrgs] = useState([]);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [sent, setSent] = useState(null);
  usePoll(() => {
    api("/admin/library")
      .then((d) => setLibrary(d.entries))
      .catch(() => {});
    api("/admin/institution-options")
      .then((d) => setOrgs(d.institutions))
      .catch(() => {});
  }, 60000);

  const set = (k, v) => {
    setF((s) => ({ ...s, [k]: v }));
    setError("");
  };
  const toggle = (k, v) =>
    set(k, f[k].includes(v) ? f[k].filter((x) => x !== v) : [...f[k], v]);
  const fromPlaybook = (name) => {
    const entry = library.find((e) => e.name === name);
    setF((s) => ({
      ...s,
      threat: name,
      actions:
        entry &&
        (!s.actions.trim() ||
          window.confirm("Replace the actions with this playbook?"))
          ? entry.steps.join("\n")
          : s.actions,
    }));
  };

  const send = async (e) => {
    e.preventDefault();
    const audience =
      f.mode === "all"
        ? { mode: "all" }
        : f.mode === "types"
          ? { mode: "types", types: f.types }
          : { mode: "orgs", orgIds: f.orgIds };
    const who =
      f.mode === "all"
        ? "ALL approved institutions"
        : f.mode === "types"
          ? `${f.types.length} sector(s)`
          : `${f.orgIds.length} institution(s)`;
    if (
      !window.confirm(
        `Send this ${f.severity} alert to ${who}? Emails go out straight away and cannot be recalled.`,
      )
    )
      return;
    setBusy(true);
    try {
      setSent(
        await api("/admin/alerts", {
          method: "POST",
          body: {
            title: f.title,
            severity: f.severity,
            summary: f.summary,
            actions: lines(f.actions),
            threat: f.threat || undefined,
            audience,
          },
        }),
      );
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  if (sent)
    return (
      <>
        <PageTitle title="Alert sent" />
        <Card className="max-w-xl">
          <p>
            Delivered to <b>{sent.delivered}</b> institution
            {sent.delivered === 1 ? "" : "s"}. It is already in their
            dashboards. Emails are being sent to <b>{sent.emailed}</b>{" "}
            {sent.emailed === 1 ? "person" : "people"}, a few at a time, so a
            long list can take several minutes.
          </p>
          <div className="mt-5 flex gap-3">
            <Link
              to={`/dashboard/admin/alerts/${sent.id}`}
              className="btn-primary"
            >
              Watch responses
            </Link>
            <Link to="/dashboard/admin/alerts" className="btn-ghost">
              All alerts
            </Link>
          </div>
        </Card>
      </>
    );

  return (
    <>
      <PageTitle
        title="Send an alert"
        intro="Tell institutions what is happening and what to do to protect their systems. Only approved institutions receive it."
      />
      <form
        onSubmit={send}
        className="grid max-w-5xl gap-6 xl:grid-cols-[1.4fr_1fr]"
      >
        <Card className="space-y-5">
          <div>
            <label htmlFor="t" className="mb-1.5 block text-sm font-semibold">
              Title
            </label>
            <input
              id="t"
              className="field"
              maxLength={150}
              placeholder="Fake refund emails targeting bank staff"
              value={f.title}
              onChange={(e) => set("title", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="sv" className="mb-1.5 block text-sm font-semibold">
              How serious is it?
            </label>
            <select
              id="sv"
              className="field"
              value={f.severity}
              onChange={(e) => set("severity", e.target.value)}
            >
              <option value="critical">Critical: act now</option>
              <option value="warning">Warning: act soon</option>
              <option value="info">Advisory: good to know</option>
            </select>
          </div>
          <div>
            <label htmlFor="s" className="mb-1.5 block text-sm font-semibold">
              What is happening
            </label>
            <textarea
              id="s"
              rows={5}
              maxLength={3000}
              className="field"
              value={f.summary}
              onChange={(e) => set("summary", e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="pb" className="mb-1.5 block text-sm font-semibold">
              Start from a playbook{" "}
              <span className="font-normal text-fg/50">(optional)</span>
            </label>
            <select
              id="pb"
              className="field"
              value={f.threat}
              onChange={(e) => fromPlaybook(e.target.value)}
            >
              <option value="">None</option>
              {library.map((e) => (
                <option key={e.id} value={e.name}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label htmlFor="a" className="mb-1.5 block text-sm font-semibold">
              What institutions should do{" "}
              <span className="font-normal text-fg/50">
                (one step per line, in order)
              </span>
            </label>
            <textarea
              id="a"
              rows={6}
              className="field"
              value={f.actions}
              onChange={(e) => set("actions", e.target.value)}
            />
          </div>
        </Card>

        <div className="space-y-6 self-start">
          <Card>
            <h2 className="font-display text-lg font-bold">
              Who should receive it
            </h2>
            <div className="mt-3 space-y-2 text-sm">
              {[
                ["all", "Every approved institution"],
                ["types", "Certain sectors"],
                ["orgs", "Chosen institutions"],
              ].map(([v, l]) => (
                <label key={v} className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="mode"
                    checked={f.mode === v}
                    onChange={() => set("mode", v)}
                  />{" "}
                  {l}
                </label>
              ))}
            </div>
            {f.mode === "types" && (
              <div className="mt-4 space-y-1.5 text-sm">
                {TYPES.map((t) => (
                  <label key={t} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={f.types.includes(t)}
                      onChange={() => toggle("types", t)}
                    />{" "}
                    {t}
                  </label>
                ))}
              </div>
            )}
            {f.mode === "orgs" && (
              <div className="mt-4 max-h-64 space-y-1.5 overflow-y-auto text-sm">
                {!orgs.length && (
                  <p className="text-fg/60">No approved institutions yet.</p>
                )}
                {orgs.map((o) => (
                  <label key={o.id} className="flex items-center gap-2">
                    <input
                      type="checkbox"
                      checked={f.orgIds.includes(o.id)}
                      onChange={() => toggle("orgIds", o.id)}
                    />{" "}
                    {o.name} <span className="text-fg/50">· {o.type}</span>
                  </label>
                ))}
              </div>
            )}
          </Card>
          {error && (
            <p role="alert" className="text-sm text-signal">
              {error}
            </p>
          )}
          <button
            className="btn-primary w-full"
            disabled={
              busy ||
              !f.title.trim() ||
              !f.summary.trim() ||
              !lines(f.actions).length
            }
          >
            {busy ? "Sending…" : "Send alert"}
          </button>
        </div>
      </form>
    </>
  );
}
