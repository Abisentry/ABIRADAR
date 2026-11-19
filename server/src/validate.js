import { z } from "zod";

const text = (max) =>
  z
    .string()
    .trim()
    .min(1, "This field is required.")
    .max(max, "This is too long.");
const list = z
  .array(z.string().trim().min(1).max(80))
  .min(1, "Choose at least one option.")
  .max(30);
const email = z
  .string()
  .trim()
  .toLowerCase()
  .email("Enter a valid email address.")
  .max(254);
const password = z
  .string()
  .min(8, "Use at least 8 characters.")
  .max(72, "Use 72 characters or fewer.");

export const signupSchema = z.object({
  fullName: text(100),
  email,
  password,
  orgName: text(150),
  orgType: text(80),
  orgSize: text(40),
  country: text(80),
  profile: z.object({
    systems: list,
    threats: list,
    channels: list,
    pastIncident: text(20),
    minSeverity: text(20),
    responders: text(80),
  }),
});
export const loginSchema = z.object({
  email,
  password: z.string().min(1).max(72),
});
export const tokenSchema = z.object({ token: z.string().min(20).max(200) });
export const forgotSchema = z.object({ email });
export const resetSchema = z.object({
  token: z.string().min(20).max(200),
  password,
});

// { fieldName: firstMessage } so the form can show errors under the right input
export function fieldErrors(zodError) {
  const out = {};
  for (const issue of zodError.issues)
    out[issue.path[issue.path.length - 1] ?? "form"] ??= issue.message;
  return out;
}

// How an institution responds to an alert. Closing it needs a note: that is the record of what was done.
export const statusSchema = z
  .object({
    status: z.enum(["new", "in_progress", "done", "not_applicable"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine(
    (d) =>
      !["done", "not_applicable"].includes(d.status) ||
      (d.note && d.note.length >= 3),
    { message: "Add a short note. It is kept as the record.", path: ["note"] },
  );

export const decisionSchema = z
  .object({
    decision: z.enum(["approved", "rejected"]),
    note: z.string().trim().max(500).optional(),
  })
  .refine((d) => d.decision === "approved" || !!d.note, {
    message: "Add a short reason so the applicant knows why.",
    path: ["note"],
  });

const assignable = z.enum(["admin", "analyst", "viewer"]);
export const inviteSchema = z.object({ email, role: assignable });
export const roleSchema = z.object({ role: assignable });
export const acceptSchema = z.object({
  token: z.string().min(20).max(200),
  fullName: text(100),
  password,
});

// The owner writes an alert and chooses who receives it.
export const composeSchema = z.object({
  title: text(150),
  severity: z.enum(["critical", "warning", "info"]),
  summary: text(3000),
  actions: z
    .array(z.string().trim().min(1).max(400))
    .min(1, "Add at least one recommended action.")
    .max(20, "You can add up to 20 recommended actions."),
  threat: z.string().trim().max(80).optional(),
  audience: z.discriminatedUnion("mode", [
    z.object({ mode: z.literal("all") }),
    z.object({
      mode: z.literal("types"),
      types: z
        .array(z.string().trim().min(1).max(80))
        .min(1, "Choose at least one type.")
        .max(50, "Choose 50 types or fewer."),
    }),
    z.object({
      mode: z.literal("orgs"),
      orgIds: z
        .array(z.string().min(1).max(60))
        .min(1, "Choose at least one institution.")
        .max(500),
    }),
  ]),
});

// ---- Content the owner manages ----
export const entrySchema = z.object({
  name: text(80),
  summary: text(600),
  signs: z
    .array(z.string().trim().min(1).max(200, "Keep each sign under 200 characters."))
    .max(20, "You can add up to 20 signs."),
  steps: z
    .array(z.string().trim().min(1).max(300, "Keep each step under 300 characters."))
    .min(1, "Add at least one response step.")
    .max(20, "You can add up to 20 response steps."),
  published: z.boolean(),
  sort: z.number().int().min(0).max(1000).default(0),
});

export const postSchema = z.object({
  kind: z.enum(["review", "community"]),
  title: text(150),
  period: z.string().trim().max(60, "Period must be 60 characters or fewer.").optional().nullable(),
  cadence: z.enum(["weekly", "monthly"]).optional().nullable(),
  body: text(10000),
  audience: z
    .array(z.string().trim().min(1).max(80, "Keep each audience tag under 80 characters."))
    .max(50, "Choose 50 audience groups or fewer.")
    .default([]),
  published: z.boolean(),
});


// ---- What institutions report to the owner ----
export const incidentSchema = z.object({
  title: text(150),
  details: text(3000),
  anonymous: z.boolean(),
});
export const incidentDecisionSchema = z.object({
  status: z.enum(["new", "reviewed", "dismissed"]),
  note: z.string().trim().max(500).optional(),
});
