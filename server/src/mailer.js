import { sendEmail } from "./email.js";

const CLIENT = (process.env.CLIENT_ORIGIN || "https://abiradar.top").replace(
  /\/$/,
  "",
);
const esc = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const join = (a) => (Array.isArray(a) ? a.join(", ") : a);
const send = (msg, opts) => sendEmail(msg, opts);

// Everything the person typed is escaped before it goes into HTML.
export function notifyNewSignup({ user, org, profile }) {
  if (!process.env.NOTIFY_EMAIL) return Promise.resolve();
  const rows = [
    ["Name", user.fullName],
    ["Email", user.email],
    ["Institution", org.name],
    ["Type", org.type],
    ["Staff size", org.size],
    ["Country", org.country],
    ["Systems to protect", join(profile.systems)],
    ["Top threats", join(profile.threats)],
    ["Recent incident", profile.pastIncident],
    ["Alert channels", join(profile.channels)],
    ["Minimum severity", profile.minSeverity],
    ["Responders", profile.responders],
  ];
  return send({
    to: process.env.NOTIFY_EMAIL,
    subject: `New signup: ${org.name.slice(0, 80)}`,
    text:
      rows.map(([k, v]) => `${k}: ${v}`).join("\n") +
      `\n\nReview it: ${CLIENT}/dashboard/admin/institutions`,
    html: `<h2>New AbiSentry Radar signup</h2><table cellpadding="6">${rows
      .map(([k, v]) => `<tr><td><b>${esc(k)}</b></td><td>${esc(v)}</td></tr>`)
      .join(
        "",
      )}</table><p><a href="${esc(CLIENT + "/dashboard/admin/institutions")}">Review this institution</a></p>`,
  });
}

export function sendVerification({ user, url }) {
  return send({
    to: user.email,
    subject: "Verify your email for AbiSentry Gossip",
    text: `Hi ${user.fullName},\n\nConfirm your email to open your dashboard (link valid for 24 hours):\n${url}\n\nIf you did not create this account, ignore this email.`,
    html: `<p>Hi ${esc(user.fullName)},</p><p>Confirm your email to open your dashboard. The link is valid for 24 hours.</p><p><a href="${esc(url)}">Verify my email</a></p><p>If you did not create this account, ignore this email.</p>`,
  });
}

export function sendPasswordReset({ user, url }) {
  return send({
    to: user.email,
    subject: "Reset your AbiSentry Gossip password",
    text: `Hi ${user.fullName},\n\nUse this link to choose a new password (valid for 1 hour):\n${url}\n\nIf you did not ask for this, ignore this email. Your password has not changed.`,
    html: `<p>Hi ${esc(user.fullName)},</p><p>Use the link below to choose a new password. It is valid for 1 hour.</p><p><a href="${esc(url)}">Reset my password</a></p><p>If you did not ask for this, ignore this email. Your password has not changed.</p>`,
  });
}

export function sendAlertEmail({ to, org, alert }) {
  const url = `${(process.env.CLIENT_ORIGIN || "https://abiradar.top").replace(/\/$/, "")}/dashboard/alerts`;
  const sev = alert.severity.toUpperCase();
  return send({
    to,
    subject: `[${sev}] ${alert.message}`.replace(/[\r\n]+/g, " ").slice(0, 150),
    text: `${org}\n\n${sev} alert\n${alert.message}\nSystem: ${alert.system}\n\nReview it: ${url}`,
    html: `<h2>${esc(sev)} alert for ${esc(org)}</h2><p>${esc(alert.message)}</p><p>System: ${esc(alert.system)}</p><p><a href="${esc(url)}">Review the alert</a></p>`,
  });
}

export function sendDecision({ user, org, decision, note }) {
  const ok = decision === "approved";
  const url = `${CLIENT}/dashboard/alerts`;
  return send({
    to: user.email,
    subject: ok
      ? `${org} is approved on AbiSentry Gossip`
      : `Your AbiSentry Gossip application for ${org}`,
    text: ok
      ? `Hi ${user.fullName},\n\n${org} has been approved. You will now receive alerts about threats that could affect you, with steps to protect your systems:\n${url}`
      : `Hi ${user.fullName},\n\nWe could not approve ${org} at this time.${note ? `\n\nReason: ${note}` : ""}\n\nReply to this email if you think this is a mistake.`,
    html: ok
      ? `<p>Hi ${esc(user.fullName)},</p><p><b>${esc(org)}</b> has been approved. You will now receive alerts about threats that could affect you, with steps to protect your systems.</p><p><a href="${esc(url)}">Open your dashboard</a></p>`
      : `<p>Hi ${esc(user.fullName)},</p><p>We could not approve <b>${esc(org)}</b> at this time.</p>${note ? `<p>Reason: ${esc(note)}</p>` : ""}<p>Reply to this email if you think this is a mistake.</p>`,
  });
}

export function sendInvite({ to, inviter, org, role, url }) {
  return send({
    to,
    subject: `${inviter} invited you to ${org} on AbiSentry Gossip`
      .replace(/[\r\n]+/g, " ")
      .slice(0, 150),
    text: `${inviter} invited you to join ${org} on AbiSentry Gossip as ${role}.\n\nAccept the invitation (valid for 7 days):\n${url}\n\nIf you were not expecting this, ignore this email.`,
    html: `<p><b>${esc(inviter)}</b> invited you to join <b>${esc(org)}</b> on AbiSentry Gossip as <b>${esc(role)}</b>.</p><p><a href="${esc(url)}">Accept the invitation</a> (valid for 7 days)</p><p>If you were not expecting this, ignore this email.</p>`,
  });
}

export function sendAdvisoryEmail({ to, org, alert }) {
  const url = `${CLIENT}/dashboard/alerts`;
  const sev = alert.severity.toUpperCase();
  const steps = alert.actions;
  return send(
    {
      to,
      subject: `[${sev}] ${alert.title}`.replace(/[\r\n]+/g, " ").slice(0, 150),
      text: `${org}\n\n${sev} alert from AbiSentry Gossip\n${alert.title}\n\n${alert.summary}\n\nWhat to do:\n${steps.map((s, i) => `${i + 1}. ${s}`).join("\n")}\n\nRecord what you did: ${url}`,
      html: `<h2>${esc(sev)} alert: ${esc(alert.title)}</h2><p>${esc(alert.summary).replace(/\n/g, "<br>")}</p><h3>What to do</h3><ol>${steps.map((s) => `<li>${esc(s)}</li>`).join("")}</ol><p><a href="${esc(url)}">Open the alert and record what you did</a></p><p style="color:#666">Sent to ${esc(org)}.</p>`,
    },
    { bulk: true },
  ); // spaced out, so a large audience does not hit the email service's rate limit
}
