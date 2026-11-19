import crypto from "node:crypto";
import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";
import jwt from "jsonwebtoken";

// Dates come back from the database as Date objects; the browser wants ISO strings.
export const iso = (d) => (d ? new Date(d).toISOString() : null);
export const sha = (t) => crypto.createHash("sha256").update(t).digest("hex");
export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const JWT_SECRET = process.env.JWT_SECRET;

// Platform admins are listed in ADMIN_EMAILS (comma separated). They review institutions and send alerts.
export const isAdmin = (email) =>
  (process.env.ADMIN_EMAILS || "")
    .toLowerCase()
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean)
    .includes(String(email).toLowerCase());

export async function mailAll(label, ...promises) {
  const results = await Promise.allSettled(promises);
  for (const r of results)
    if (r.status === "rejected")
      console.error(`${label} failed:`, r.reason?.message);
}


export function signPending2faToken(userId) {
  return jwt.sign({ sub: userId, purpose: "2fa_challenge" }, JWT_SECRET, {
    expiresIn: "5m",
  });
}

export function verifyPending2faToken(token) {
  try {
    const payload = jwt.verify(token, JWT_SECRET);
    if (payload.purpose !== "2fa_challenge") return null;
    return payload.sub; // returns userId
  } catch {
    return null;
  }
}



const APP_NAME = "AbiRadar";

export async function createTotpSetup(userEmail) {
  const secret = generateSecret();
  const uri = generateURI({
    issuer: APP_NAME,
    label: userEmail,
    secret,
  });
  const qrCodeDataUrl = await QRCode.toDataURL(uri);

  return { secret, uri, qrCodeDataUrl };
}

export async function verifyTotpCode(secret, token) {
  const result = await verify({ secret, token });
  return result.valid;
}

// Generates 8 single-use backup codes like "A1B2-C3D4"
export function generateBackupCodes(count = 8) {
  return Array.from({ length: count }, () => {
    const part1 = crypto.randomBytes(2).toString("hex").toUpperCase();
    const part2 = crypto.randomBytes(2).toString("hex").toUpperCase();
    return `${part1}-${part2}`;
  });
}
