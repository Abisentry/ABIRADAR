import { store } from "./store/index.js";
import { sendAdvisoryEmail } from "./mailer.js";
import { mailAll } from "./util.js";

const RANK = { info: 0, warning: 1, critical: 2 };
const MIN = { all: 0, warning: 1, critical: 2 };

// Owners, admins and analysts of these institutions who want this alert by email, following their saved preferences.
export async function collectRecipients(alert, orgs) {
  const out = [];
  for (const o of orgs) {
    if (
      !o.profile.channels?.includes("Email") ||
      RANK[alert.severity] < (MIN[o.profile.minSeverity] ?? 0)
    )
      continue;
    for (const m of await store.find("members", { where: { orgId: o.id } }))
      if (["owner", "admin", "analyst"].includes(m.role))
        out.push({ to: m.userEmail, org: o.name });
  }
  return out;
}

// A few at a time. The email layer spaces them out further if the email service has a rate limit.
export async function sendTo(recipients, alert) {
  for (let i = 0; i < recipients.length; i += 10)
    await mailAll(
      "Alert email",
      ...recipients
        .slice(i, i + 10)
        .map((r) => sendAdvisoryEmail({ to: r.to, org: r.org, alert })),
    );
}

// Runs inside the Netlify background function: works out who to email from what is saved, then sends.
export async function sendAlertEmails(alertId) {
  const alert = await store.get("alerts", alertId);
  if (!alert) return 0;
  const deliveries = await store.find("deliveries", { where: { alertId } });
  const orgs = (
    await Promise.all(
      deliveries.map((d) => store.get("organisations", d.orgId)),
    )
  ).filter(Boolean);
  const recipients = await collectRecipients(alert, orgs);
  await sendTo(recipients, alert);
  return recipients.length;
}

// Normal server: send after replying. Netlify: a function stops when it replies, and a large audience takes minutes,
// so the job is handed to a background function (which may run for up to 15 minutes).
export async function dispatchAlertEmails(alertId, alert, recipients) {
  if (process.env.ALERT_EMAILS !== "background")
    return void sendTo(recipients, alert).catch((e) =>
      console.error("Alert emails stopped:", e.message),
    );
  try {
    const site = (process.env.CLIENT_ORIGIN || "").replace(/\/$/, "");
    const res = await fetch(
      `${site}/.netlify/functions/send-alert-emails-background`,
      {
        method: "POST",
        headers: {
          "content-type": "application/json",
          "x-internal-secret": process.env.INTERNAL_SECRET || "",
        },
        body: JSON.stringify({ alertId }),
        signal: AbortSignal.timeout(8000),
      },
    );
    if (res.status !== 202)
      console.error(
        `The email job did not start (status ${res.status}). The alert is saved; the emails were not sent.`,
      );
  } catch (e) {
    console.error("Could not start the email job:", e.message);
  }
}
