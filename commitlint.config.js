export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "scope-enum": [1, "always", ["web", "api", "shared", "config", "deps", "docs"]],
  },
};
