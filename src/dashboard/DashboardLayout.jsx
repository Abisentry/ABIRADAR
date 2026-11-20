import { useEffect, useRef, useState } from "react";
import {
  Navigate,
  NavLink,
  Outlet,
  useLocation,
  useNavigate,
} from "react-router-dom";
import {
  Bell,
  Search,
  FileText,
  Gauge,
  BookOpen,
  Building2,
  Users,
  LayoutDashboard,
  ShieldCheck,
  UserPlus,
  Lock,
} from "lucide-react";
import Logo from "../components/Logo.jsx";
import { api } from "../lib/api.js";
import { usePoll } from "../lib/usePoll.js";
import VerifyPending from "./VerifyPending.jsx";
import { ROLES } from "../data/roles.js";

const IDLE_LIMIT_MS = 10 * 60 * 1000; // 10 minutes
const WARN_AT_MS = 9 * 60 * 1000; // Show warning at 9 minutes (60s left)
const ACTIVITY_KEY = "abi_last_active";

// The eight dashboard functions, plus Team. Platform admins also get the owner pages.
export const modules = [
  {
    to: "/dashboard",
    end: true,
    label: "Dashboard & Analytics",
    Icon: LayoutDashboard,
  },
  {
    to: "alerts",
    label: "Real-time Fraud Alerts",
    Icon: Bell,
    perm: "alerts:view",
  },
  { to: "library", label: "Fraud Library & Search", Icon: Search },
  { to: "reports", label: "Weekly / Monthly Reports", Icon: FileText },
  { to: "risk", label: "Risk Readiness Score", Icon: Gauge },
  { to: "playbooks", label: "Playbooks & Response Guides", Icon: BookOpen },
  { to: "departments", label: "Department Intelligence", Icon: Building2 },
  { to: "community", label: "Community Reporting", Icon: Users },
  { to: "team", label: "Team", Icon: UserPlus, perm: "team:manage" },
];
const adminModules = [
  {
    to: "/dashboard/admin",
    end: true,
    label: "Platform overview",
    Icon: ShieldCheck,
  },
  {
    to: "/dashboard/admin/institutions",
    label: "Institutions",
    Icon: Building2,
  },
  { to: "/dashboard/admin/users", label: "Users", Icon: Users },
  { to: "/dashboard/admin/alerts", label: "Alerts", Icon: Bell },
  { to: "/dashboard/admin/library", label: "Fraud library", Icon: Search },
  { to: "/dashboard/admin/reviews", label: "Fraud reviews", Icon: FileText },
  { to: "/dashboard/admin/community", label: "Community", Icon: Users },
];

export default function DashboardLayout() {
  const [me, setMe] = useState(null);
  const [secondsLeft, setSecondsLeft] = useState(null);
  const navigate = useNavigate();
  const { pathname } = useLocation();
  const loggingOutRef = useRef(false);

  const logout = async (timedOut = false) => {
    if (loggingOutRef.current) return;
    loggingOutRef.current = true;
    localStorage.removeItem(ACTIVITY_KEY);
    await api("/auth/logout", { method: "POST" }).catch(() => {});
    navigate(timedOut ? "/login?timeout=1" : "/", { replace: true });
  };

  const getIdleMs = () => {
    const last = Number(localStorage.getItem(ACTIVITY_KEY) || Date.now());
    return Date.now() - last;
  };

  const stayLoggedIn = () => {
    localStorage.setItem(ACTIVITY_KEY, String(Date.now()));
    setSecondsLeft(null);
    api("/auth/me")
      .then(setMe)
      .catch(() => navigate("/login", { replace: true }));
  };

  // Track active user interaction across tabs and enforce the 10-minute idle limit
  useEffect(() => {
    let lastWrite = Date.now();
    localStorage.setItem(ACTIVITY_KEY, String(lastWrite));

    const recordActivity = () => {
      // Once the final 60s warning appears, require an explicit click on "Stay logged in"
      if (getIdleMs() >= WARN_AT_MS) return;
      const now = Date.now();
      if (now - lastWrite > 5000) {
        lastWrite = now;
        localStorage.setItem(ACTIVITY_KEY, String(now));
      }
    };

    const events = [
      "mousemove",
      "mousedown",
      "keydown",
      "scroll",
      "touchstart",
    ];
    events.forEach((ev) =>
      window.addEventListener(ev, recordActivity, { passive: true }),
    );

    const timer = setInterval(() => {
      const idleMs = getIdleMs();
      if (idleMs >= IDLE_LIMIT_MS) {
        logout(true);
      } else if (idleMs >= WARN_AT_MS) {
        setSecondsLeft(Math.max(1, Math.ceil((IDLE_LIMIT_MS - idleMs) / 1000)));
      } else {
        setSecondsLeft(null);
      }
    }, 1000);

    return () => {
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
      clearInterval(timer);
    };
  }, []);

  // Re-checks every 30s while active; pauses once warning/idle triggers so cookie expires cleanly
  const refresh = () => {
    const idleMs = getIdleMs();
    if (idleMs >= IDLE_LIMIT_MS) return logout(true);
    if (idleMs >= WARN_AT_MS) return;
    return api("/auth/me")
      .then(setMe)
      .catch(() => navigate("/login", { replace: true }));
  };
  usePoll(refresh, 30000);

  if (!me) return <p className="p-10 text-fg/70">Loading your dashboard…</p>;
  if (!me.user.emailVerified)
    return (
      <VerifyPending
        email={me.user.email}
        onRefresh={refresh}
        onLogout={() => logout(false)}
      />
    );

  const org = me.organisation;
  const adminOnly = !org && me.user.isAdmin;
  if (adminOnly && pathname === "/dashboard")
    return <Navigate to="/dashboard/admin" replace />;
  if (!org && !me.user.isAdmin)
    return (
      <p className="p-10 text-fg/70">
        No institution is linked to this account.{" "}
        <button className="underline" onClick={() => logout(false)}>
          Log out
        </button>
      </p>
    );

  const allowed = modules.filter(
    (m) => !m.perm || org?.permissions?.includes(m.perm),
  );
  const securityItem = {
    to: "/dashboard/security",
    label: "Security (2FA)",
    Icon: Lock,
  };
  const nav = [
    ...(adminOnly
      ? adminModules
      : me.user.isAdmin
        ? [...allowed, ...adminModules]
        : allowed),
    securityItem,
  ];

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[18rem_1fr]">
      <aside className="border-b border-line bg-surface lg:min-h-screen lg:border-b-0 lg:border-r">
        <div className="px-4 py-3 lg:px-5 lg:py-6">
          <Logo size="h-9" />
        </div>
        <nav
          className="flex gap-1 overflow-x-auto px-3 pb-3 lg:flex-col lg:pb-0"
          aria-label="Dashboard"
        >
          {nav.map(({ to, end, label, Icon }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex shrink-0 items-center gap-3 rounded-md px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? "bg-cyan/15 text-cyan" : "text-fg/75 hover:bg-fg/5"}`
              }
            >
              <Icon size={18} aria-hidden /> {label}
            </NavLink>
          ))}
        </nav>
      </aside>
      <div className="min-w-0">
        <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
          <p className="truncate font-display font-bold">
            {org?.name || "AbiSentry administration"}
          </p>
          <div className="flex items-center gap-3 text-sm">
            <span className="hidden text-fg/70 sm:block">
              {me.user.fullName} ·{" "}
              {org ? ROLES[org.role]?.label : "Platform admin"}
            </span>
            <button
              className="btn-ghost !px-3 !py-1.5"
              onClick={() => logout(false)}
            >
              Log out
            </button>
          </div>
        </header>
        {secondsLeft !== null && (
          <div
            role="alert"
            className="flex flex-wrap items-center justify-between gap-3 border-b border-signal/40 bg-signal/15 px-5 py-3 text-sm"
          >
            <p className="font-medium text-signal">
              You will be logged out due to inactivity in{" "}
              <span className="font-mono font-bold">{secondsLeft}s</span>.
            </p>
            <button
              type="button"
              onClick={stayLoggedIn}
              className="btn-primary !px-3 !py-1.5 text-xs"
            >
              Stay logged in
            </button>
          </div>
        )}
        {org?.status === "pending" && (
          <p
            role="status"
            className="border-b border-amber/40 bg-amber/10 px-5 py-3 text-sm text-amber"
          >
            Your institution is under review. We will email you when it is
            approved. Alerts start arriving once it is.{" "}
            <button className="underline" onClick={refresh}>
              Check status
            </button>
          </p>
        )}
        {org?.status === "rejected" && (
          <p
            role="alert"
            className="border-b border-signal/40 bg-signal/10 px-5 py-3 text-sm text-signal"
          >
            We could not approve this institution.
            {org.reviewNote ? ` Reason: ${org.reviewNote}` : ""} Reply to our
            email if you think this is a mistake.
          </p>
        )}
        <main className="px-5 py-8 lg:px-10">
          <Outlet context={{ ...me, refresh }} />
        </main>
      </div>
    </div>
  );
}
