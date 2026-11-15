export const ROLES = {
  owner: {
    label: "Owner",
    desc: "Full control. Created the account and cannot be removed.",
  },
  admin: { label: "Admin", desc: "Everything, including managing the team." },
  analyst: {
    label: "Analyst",
    desc: "Receives alerts and responds to them: starts work, marks them done, records what was done.",
  },
  viewer: {
    label: "Viewer",
    desc: "Can read alerts but cannot respond or change anything.",
  },
};
// Mirrors the server: the owner manages admins, admins manage everyone below them.
export const assignable = (myRole) =>
  myRole === "owner"
    ? ["admin", "analyst", "viewer"]
    : myRole === "admin"
      ? ["analyst", "viewer"]
      : [];
