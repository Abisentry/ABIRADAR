import rateLimit from "express-rate-limit";
import { store } from "./store/index.js";

// On a normal server the counts live in memory. On Netlify each request may run in a fresh function that remembers
// nothing, so when the database supports it (Convex) the counts are kept there instead.
const onNetlify = Boolean(
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
);

class DatabaseRateStore {
  constructor(name) {
    this.name = name;
    this.localKeys = false;
  }
  init(options) {
    this.windowMs = options.windowMs;
  }
  async increment(key) {
    const r = await store.rateHit(`${this.name}:${key}`, this.windowMs);
    return { totalHits: r.count, resetTime: new Date(r.resetAt) };
  }
  async decrement() {}
  async resetKey() {}
}

let count = 0; // each limiter gets a stable name, so its counts stay separate from the others
export function limiter(
  max,
  windowMin,
  message = "Too many attempts. Please wait a few minutes and try again.",
) {
  const name = `rl${++count}`;
  return rateLimit({
    windowMs: windowMin * 60 * 1000,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    validate: false,
    message: { error: message },
    keyGenerator: (req) =>
      (onNetlify && req.headers["x-nf-client-connection-ip"]) || req.ip,
    ...(store.rateHit ? { store: new DatabaseRateStore(name) } : {}),
  });
}
