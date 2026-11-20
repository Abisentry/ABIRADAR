import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../lib/api.js";
import { ROLES } from "../data/roles.js";

export default function AdminUsers() {
  const [users, setUsers] = useState([]);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("all"); // "all" | "active" | "suspended" | "2fa"
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  // Suspend modal state
  const [suspendTarget, setSuspendTarget] = useState(null);
  const [suspendReason, setSuspendReason] = useState("");

  const load = async () => {
    try {
      const data = await api("/admin/users");
      setUsers(data.users || []);
    } catch (err) {
      setError(err.message || "Could not load users.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const flash = (msg) => {
    setNotice(msg);
    setError("");
  };

  const handleSuspendSubmit = async (e) => {
    e.preventDefault();
    if (!suspendTarget) return;
    setBusyId(suspendTarget.id);
    setError("");
    try {
      await api(`/admin/users/${suspendTarget.id}/suspend`, {
        method: "POST",
        body: { suspend: true, reason: suspendReason },
      });
      flash(`Suspended ${suspendTarget.email}.`);
      setSuspendTarget(null);
      setSuspendReason("");
      await load();
    } catch (err) {
      setError(err.message || "Could not suspend user.");
    } finally {
      setBusyId(null);
    }
  };

  const handleUnsuspend = async (u) => {
    setBusyId(u.id);
    setError("");
    try {
      await api(`/admin/users/${u.id}/suspend`, {
        method: "POST",
        body: { suspend: false },
      });
      flash(`Restored access for ${u.email}.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not unsuspend user.");
    } finally {
      setBusyId(null);
    }
  };

  const handleReset2fa = async (u) => {
    if (
      !window.confirm(
        `Reset 2FA for ${u.fullName} (${u.email})? They will be logged out and can set up a new authenticator app.`,
      )
    )
      return;
    setBusyId(u.id);
    setError("");
    try {
      await api(`/admin/users/${u.id}/reset-2fa`, { method: "POST" });
      flash(`Reset 2FA for ${u.email}.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not reset 2FA.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRevokeSessions = async (u) => {
    setBusyId(u.id);
    setError("");
    try {
      await api(`/admin/users/${u.id}/revoke-sessions`, { method: "POST" });
      flash(`Signed out all devices for ${u.email}.`);
    } catch (err) {
      setError(err.message || "Could not revoke sessions.");
    } finally {
      setBusyId(null);
    }
  };

  const handleDelete = async (u) => {
    if (
      !window.confirm(
        `Permanently delete ${u.fullName} (${u.email})? This cannot be undone.`,
      )
    )
      return;
    setBusyId(u.id);
    setError("");
    try {
      await api(`/admin/users/${u.id}`, { method: "DELETE" });
      flash(`Deleted account ${u.email}.`);
      await load();
    } catch (err) {
      setError(err.message || "Could not delete account.");
    } finally {
      setBusyId(null);
    }
  };

  const q = query.trim().toLowerCase();
  const visible = users.filter((u) => {
    if (filter === "suspended" && !u.suspended) return false;
    if (filter === "active" && u.suspended) return false;
    if (filter === "2fa" && !u.totpEnabled) return false;
    if (!q) return true;
    return (
      u.fullName?.toLowerCase().includes(q) ||
      u.email?.toLowerCase().includes(q) ||
      u.orgName?.toLowerCase().includes(q)
    );
  });

  const counts = {
    all: users.length,
    active: users.filter((u) => !u.suspended).length,
    suspended: users.filter((u) => u.suspended).length,
    "2fa": users.filter((u) => u.totpEnabled).length,
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">User accounts</h1>
          <p className="mt-1 text-sm text-fg/70">
            Suspend accounts, reset lost 2FA devices, revoke sessions, or delete
            users.
          </p>
        </div>

        <input
          type="search"
          placeholder="Search name, email, or institution…"
          className="field w-full sm:w-72"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {/* Filter pills */}
      <div className="flex flex-wrap gap-2">
        {[
          ["all", `All (${counts.all})`],
          ["active", `Active (${counts.active})`],
          ["suspended", `Suspended (${counts.suspended})`],
          ["2fa", `2FA enabled (${counts["2fa"]})`],
        ].map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => setFilter(key)}
            className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              filter === key
                ? "bg-cyan/15 text-cyan"
                : "bg-surface text-fg/75 hover:bg-fg/5"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {error && (
        <p
          role="alert"
          className="rounded-lg border border-signal/40 bg-signal/10 px-4 py-3 text-sm text-signal"
        >
          {error}
        </p>
      )}
      {notice && (
        <p
          role="status"
          className="rounded-lg border border-cyan/40 bg-cyan/10 px-4 py-3 text-sm text-cyan"
        >
          {notice}
        </p>
      )}

      {/* Suspend Reason Modal */}
      {suspendTarget && (
        <form
          onSubmit={handleSuspendSubmit}
          className="rounded-xl border border-amber/40 bg-surface p-5 space-y-4"
        >
          <div>
            <h2 className="text-base font-bold">
              Suspend {suspendTarget.fullName} ({suspendTarget.email})
            </h2>
            <p className="mt-1 text-sm text-fg/70">
              They will be logged out immediately and blocked from signing in.
            </p>
          </div>
          <div>
            <label
              htmlFor="suspend-reason"
              className="mb-1.5 block text-sm font-semibold"
            >
              Reason (optional, shown to the user on login)
            </label>
            <input
              id="suspend-reason"
              type="text"
              maxLength={300}
              placeholder="e.g., Compromised credentials or policy violation"
              className="field"
              value={suspendReason}
              onChange={(e) => setSuspendReason(e.target.value)}
            />
          </div>
          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={busyId === suspendTarget.id}
              className="rounded-lg bg-amber px-4 py-2 text-sm font-semibold text-black hover:opacity-90 disabled:opacity-50"
            >
              {busyId === suspendTarget.id ? "Suspending…" : "Confirm suspend"}
            </button>
            <button
              type="button"
              onClick={() => {
                setSuspendTarget(null);
                setSuspendReason("");
              }}
              className="text-sm text-fg/70 hover:underline"
            >
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* Users Table */}
      {loading ? (
        <p className="text-sm text-fg/70">Loading user accounts…</p>
      ) : visible.length === 0 ? (
        <p className="rounded-xl border border-line bg-surface p-6 text-sm text-fg/70">
          No matching user accounts found.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-line bg-surface">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-line text-xs uppercase text-fg/60">
              <tr>
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3">Institution</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3">2FA</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {visible.map((u) => {
                const isBusy = busyId === u.id;
                return (
                  <tr key={u.id} className="align-top">
                    <td className="px-4 py-3.5">
                      <div className="font-semibold">
                        {u.fullName}{" "}
                        {u.isAdmin && (
                          <span className="ml-1.5 rounded bg-cyan/15 px-1.5 py-0.5 text-xs font-medium text-cyan">
                            Admin
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-fg/70">{u.email}</div>
                      {u.suspended && u.suspendedReason && (
                        <div className="mt-1 text-xs text-amber">
                          Reason: {u.suspendedReason}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      {u.orgName ? (
                        <div>
                          <Link
                            to={`/dashboard/admin/institutions/${u.orgId}`}
                            className="font-medium text-cyan hover:underline"
                          >
                            {u.orgName}
                          </Link>
                          {u.role && (
                            <div className="text-xs text-fg/70">
                              {ROLES[u.role]?.label || u.role}
                            </div>
                          )}
                        </div>
                      ) : (
                        <span className="text-xs text-fg/50">—</span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      {u.suspended ? (
                        <span className="rounded-full bg-signal/15 px-2.5 py-0.5 text-xs font-semibold text-signal">
                          Suspended
                        </span>
                      ) : u.emailVerified ? (
                        <span className="rounded-full bg-cyan/15 px-2.5 py-0.5 text-xs font-semibold text-cyan">
                          Active
                        </span>
                      ) : (
                        <span className="rounded-full bg-amber/15 px-2.5 py-0.5 text-xs font-semibold text-amber">
                          Unverified
                        </span>
                      )}
                    </td>

                    <td className="px-4 py-3.5">
                      <span
                        className={`text-xs font-semibold ${
                          u.totpEnabled ? "text-cyan" : "text-fg/50"
                        }`}
                      >
                        {u.totpEnabled ? "Enabled" : "Off"}
                      </span>
                    </td>

                    <td className="px-4 py-3.5 text-right">
                      {u.isAdmin ? (
                        <span className="text-xs text-fg/50">Protected</span>
                      ) : (
                        <div className="flex flex-wrap justify-end gap-2">
                          {u.suspended ? (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleUnsuspend(u)}
                              className="btn-ghost !px-2.5 !py-1 text-xs text-cyan"
                            >
                              Unsuspend
                            </button>
                          ) : (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => {
                                setSuspendTarget(u);
                                setSuspendReason("");
                                setError("");
                              }}
                              className="btn-ghost !px-2.5 !py-1 text-xs text-amber"
                            >
                              Suspend
                            </button>
                          )}

                          {u.totpEnabled && (
                            <button
                              type="button"
                              disabled={isBusy}
                              onClick={() => handleReset2fa(u)}
                              className="btn-ghost !px-2.5 !py-1 text-xs"
                            >
                              Reset 2FA
                            </button>
                          )}

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleRevokeSessions(u)}
                            className="btn-ghost !px-2.5 !py-1 text-xs"
                          >
                            Log out
                          </button>

                          <button
                            type="button"
                            disabled={isBusy}
                            onClick={() => handleDelete(u)}
                            className="btn-ghost !px-2.5 !py-1 text-xs text-signal"
                          >
                            Delete
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

