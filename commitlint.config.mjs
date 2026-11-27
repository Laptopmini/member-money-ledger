// Conventional Commits. No trailer rules: commits carry no Co-Authored-By or AI attribution lines.
export default {
  extends: ["@commitlint/config-conventional"],
  rules: {
    "body-max-line-length": [0],
  },
};
