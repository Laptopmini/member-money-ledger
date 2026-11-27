@AGENTS.md

# Claude-specific notes

- **Subagents** (`.claude/agents/`): `backend-engineer` (api/), `frontend-engineer` (web/),
  `qa-engineer` (tests), `reviewer` (read-only, opus), `devops` (root config, haiku).
  Subagents never commit; the main session reviews, runs gates and commits.
- **Skills** (`.claude/skills/`): `verify`, `reset-demo`, `adr`.
- **The clock**: the build was time-boxed to 2 hours from T0 (planned for 90 minutes); see
  `docs/process/03-execution-log.md`. Log notable AI mistakes in `docs/ai-log.md` as they happen.
