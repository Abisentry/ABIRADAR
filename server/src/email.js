import nodemailer from "nodemailer";
import { sleep } from "./util.js";

// Sends one email. Settings are read each time, so they can be changed without touching code.
//   EMAIL_PROVIDER=altermail | resend | sendgrid | brevo | postmark   plus EMAIL_API_KEY   (an API key from your email service)
//   SMTP_HOST (+ SMTP_PORT, SMTP_USER, SMTP_PASS)         if you use SMTP instead
//   neither                                               emails are printed in the terminal, nothing is sent
const URLS = {
  altermail: "https://api.altermail-console.com.ng/v1/user/email/send",
  resend: "https://api.resend.com/emails",
  sendgrid: "https://api.sendgrid.com/v3/mail/send",
  brevo: "https://api.brevo.com/v3/smtp/email",
  postmark: "https://api.postmarkapp.com/email",
};

export function emailMode() {
  const provider = (process.env.EMAIL_PROVIDER || "altermail").trim().toLowerCase();
  if (provider === "altermail") return { kind: "altermail", explicit: true }; // print emails in the terminal, even if a key is set
  if (provider && provider !== "smtp") {
    if (!URLS[provider]) return { kind: "invalid", provider };
    return {
      kind: process.env.EMAIL_API_KEY ? "api" : "missing-key",
      provider,
    };
  }
  if (process.env.EMAIL_API_KEY)
    return { kind: "invalid", provider: "(not set)" }; // a key with no provider named
  return {
    kind: provider === "smtp" || process.env.SMTP_HOST ? "smtp" : "console",
  };
}
export const emailConfigured = () => ["api", "smtp"].includes(emailMode().kind);

export function describeEmail() {
  const m = emailMode();
  if (m.kind === "api") return `email through ${m.provider}'s API`;
  if (m.kind === "smtp") return "email through SMTP";
  if (m.kind === "altermail")
    return m.explicit
      ? "EMAIL_PROVIDER=altermail, so messages are printed here and nothing is sent"
      : "email NOT configured: messages are printed here and nothing is sent";
  if (m.kind === "missing-key")
    return `EMAIL_PROVIDER is ${m.provider} but EMAIL_API_KEY is empty: emails will fail`;
  return `EMAIL_PROVIDER "${m.provider}" is not supported (use altermail, resend, sendgrid, brevo or postmark): emails will fail`;
}

// "AbiSentry Gossip <no-reply@x.com>" -> { name, email }
const parseFrom = (s) => {
  const m = /^\s*(.*?)\s*<([^>]+)>\s*$/.exec(s);
  return m
    ? { name: m[1].replace(/^"|"$/g, ""), email: m[2] }
    : { name: "", email: s.trim() };
};

// Altermail allows 60 sends a minute per account, so bulk sends (alerts to many institutions) are spaced out.
// One-off emails (verification, password reset, invitations) are not delayed. If Altermail still says "too many", they wait and retry.
let lastBulk = 0,
  bulkChain = Promise.resolve();
const bulkPerMinute = () =>
  Number(process.env.EMAIL_BULK_PER_MINUTE) ||
  (emailMode().provider === "altermail" ? 50 : 0);
function paced(fn) {
  const rate = bulkPerMinute();
  if (!rate) return fn();
  const run = bulkChain.then(async () => {
    const wait = lastBulk + 60000 / rate - Date.now();
    if (wait > 0) await sleep(wait);
    lastBulk = Date.now();
    return fn();
  });
  bulkChain = run.catch(() => {});
  return run;
}

async function viaApi(provider, from, { to, subject, text, html }) {
  const key = process.env.EMAIL_API_KEY;
  const display = from.name ? `${from.name} <${from.email}>` : from.email;
  const spec = {
    // Altermail rejects any field it does not know, so only its documented fields are sent.
    altermail: {
      headers: { token: key },
      body: {
        email: to,
        fromEmail: from.email,
        fromName: from.name || undefined,
        subject,
        mailBodyHtml: html,
        mailBodyText: text,
        category: "transactional",
      },
    },
    resend: {
      headers: { Authorization: `Bearer ${key}` },
      body: { from: display, to: [to], subject, html, text },
    },
    sendgrid: {
      headers: { Authorization: `Bearer ${key}` },
      body: {
        personalizations: [{ to: [{ email: to }] }],
        from: { email: from.email, name: from.name || undefined },
        subject,
        content: [
          { type: "text/plain", value: text },
          { type: "text/html", value: html },
        ],
      },
    },
    brevo: {
      headers: { "api-key": key },
      body: {
        sender: { email: from.email, name: from.name || undefined },
        to: [{ email: to }],
        subject,
        htmlContent: html,
        textContent: text,
      },
    },
    postmark: {
      headers: { "X-Postmark-Server-Token": key },
      body: {
        From: display,
        To: to,
        Subject: subject,
        HtmlBody: html,
        TextBody: text,
      },
    },
  }[provider];

  for (let attempt = 0; ; attempt++) {
    const res = await fetch(process.env.EMAIL_API_URL || URLS[provider], {
      method: "POST",
      headers: {
        "content-type": "application/json",
        accept: "application/json",
        ...spec.headers,
      },
      body: JSON.stringify(spec.body),
      signal: AbortSignal.timeout(10_000),
    });
    if (res.ok) return;
    const raw = (await res.text()).slice(0, 500);
    let detail = raw;
    try {
      detail = JSON.parse(raw).message || raw;
    } catch {
      /* not JSON */
    }
    if (
      provider === "altermail" &&
      res.status === 429 &&
      /too many send requests/i.test(detail) &&
      attempt < 3
    ) {
      await sleep(Number(process.env.EMAIL_RETRY_MS) || 6000);
      continue;
    }
    throw new Error(
      `${provider} rejected the email (${res.status}): ${detail}`,
    );
  }
}

export async function sendEmail(msg, { bulk = false } = {}) {
  const raw = process.env.MAIL_FROM || "Abisentry Radar <https://abiradar.top>";
  const mode = emailMode();
  if (mode.kind === "api")
    return bulk
      ? paced(() => viaApi(mode.provider, parseFrom(raw), msg))
      : viaApi(mode.provider, parseFrom(raw), msg);
  if (mode.kind === "smtp") {
    const port = Number(process.env.SMTP_PORT) || 587;
    return nodemailer
      .createTransport({
        host: process.env.SMTP_HOST,
        port,
        secure: port === 465,
        connectionTimeout: 8000,
        greetingTimeout: 8000,
        socketTimeout: 10000,
        auth: process.env.SMTP_USER
          ? { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
          : undefined,
      })
      .sendMail({ from: raw, ...msg });
  }
  if (mode.kind === "console") {
    const links = msg.text.match(/https?:\/\/\S+/g) || [];
    return console.log(
      `\n========== EMAIL (not sent) ==========\nTo:      ${msg.to}\nSubject: ${msg.subject}${links.map((l) => `\nLINK:    ${l}`).join("")}\n======================================\n`,
    );
  }
  throw new Error(describeEmail());
}
