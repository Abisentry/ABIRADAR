import crypto from "node:crypto";
import { createMemoryStore } from "./memory.js";
import { createConvexStore } from "./convex.js";

// Time-ordered ids, so listing documents by id gives oldest first.
export const newId = () =>
  Date.now().toString(36).padStart(9, "0") +
  crypto.randomBytes(4).toString("hex");

// STORE=convex   live (chosen automatically when CONVEX_URL is set)
// STORE=file     local development: saved to ./data/store.json, nothing to install (the default)
// STORE=memory   tests
const kind = process.env.STORE || (process.env.CONVEX_URL ? "convex" : "file");
const serverless = Boolean(
  process.env.NETLIFY || process.env.AWS_LAMBDA_FUNCTION_NAME,
);
if (
  (serverless || process.env.NODE_ENV === "production") &&
  !["convex", "memory"].includes(kind)
)
  // memory only when asked for, by the tests
  throw new Error(
    "This server needs the Convex database. Set CONVEX_URL and STORE_SECRET in the site settings (see DEPLOY.md).",
  );

export const store =
  kind === "convex"
    ? createConvexStore()
    : createMemoryStore({
        file:
          kind === "file"
            ? process.env.STORE_FILE || "./data/store.json"
            : undefined,
      });
