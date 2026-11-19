import { useState } from "react";
import { Link } from "react-router-dom";
import { Card, Empty, SevBadge, Progress } from "./ui.jsx";
import { api } from "../lib/api.js";
import { usePoll } from "../lib/usePoll.js";
import { timeAgo } from "../lib/time.js";

const pill = (on) =>
  `rounded-full border px-3.5 py-1.5 text-sm ${on ? "border-cyan bg-cyan text-bg" : "border-line hover:border-cyan"}`;
const audienceText = (a) =>
  a.mode === "all"
    ? "All approved institutions"
    : a.mode === "types"
      ? a.types.join(", ")
      : `${a.orgIds.length} chosen institution${a.orgIds.length === 1 ? "" : "s"}`;

export default function AdminAlerts() {
  const [severity, setSeverity] = useState("all");
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  usePoll(
    () =>
      api(`/admin/alerts?severity=${severity}`)
        .then((d) => {
          setData(d);
          setError("");
        })
        .catch((e) => setError(e.message)),
    10000,
    [severity],
  );

  return (
    <>
      <div className="mb-8 flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold">Alerts</h1>
          <p className="mt-2 max-w-2xl text-fg/70">
            Alerts you have sent, and how the institutions are responding.
          </p>
        </div>
        <Link to="/dashboard/admin/alerts/new" className="btn-primary">
          Send an alert
        </Link>
      </div>
      <Card>
        <div
          className="mb-4 flex flex-wrap gap-2"
          role="group"
          aria-label="Severity"
        >
          {[
            ["all", "Any severity"],
            ["critical", "Critical"],
            ["warning", "Warning"],
            ["info", "Advisory"],
          ].map(([v, l]) => (
            <button
              key={v}
              className={pill(severity === v)}
              aria-pressed={severity === v}
              onClick={() => setSeverity(v)}
            >
              {l}
            </button>
          ))}
        </div>
        {error && (
          <p role="alert" className="mb-3 text-sm text-signal">
            {error}
          </p>
        )}
        {!data ? (
          <p className="text-fg/60">Loading…</p>
        ) : !data.alerts.length ? (
          <Empty>No alerts yet. Send the first one.</Empty>
        ) : (
          <ul>
            {data.alerts.map((a) => (
              <li
                key={a.id}
                className="border-t border-line py-4 first:border-t-0"
              >
                <div className="flex flex-wrap items-center gap-3">
                  <SevBadge severity={a.severity} />
                  <span className="text-xs text-fg/50">
                    sent {timeAgo(a.sentAt)} by {a.sentBy}
                  </span>
                  {a.withdrawn && (
                    <span className="text-xs text-signal">Withdrawn</span>
                  )}
                </div>
                <Link
                  to={`/dashboard/admin/alerts/${a.id}`}
                  className="mt-1 block font-display text-lg font-bold hover:text-cyan"
                >
                  {a.title}
                </Link>
                <p className="mt-1 text-sm text-fg/60">
                  To: {audienceText(a.audience)} · {a.stats.total} institution
                  {a.stats.total === 1 ? "" : "s"}
                </p>
                <div className="mt-1">
                  <Progress s={a.stats} />
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
