# Roles

| Role | Who | Does |
|---|---|---|
| Owner | the human | Decides (answers the open questions), runs Claude Design, pushes and publishes. |
| Main session | Claude Opus | Tech lead and orchestrator: plans, delegates, reviews, commits. |
| Subagents | see below | Specialists with a bounded scope. |
| Claude Design | separate Claude product | Builds the UI from the handoff in `docs/design/handoff/`; the handback zip is unzipped into `design/`. |
| Technical writer | Sonnet, general-purpose | Wrote the ADRs, security notes and docs index. |

## Subagents (`.claude/agents/*.md`)

| Name | Model | Owns | Tools |
|---|---|---|---|
| backend-engineer | sonnet | `api/` (Django, DRF, sync, money rules) | Read, Write, Edit, Bash, Grep, Glob |
| frontend-engineer | sonnet | `web/` (React, TanStack Query, CSS tokens) | Read, Write, Edit, Bash, Grep, Glob |
| qa-engineer | sonnet | tests: `api/**/tests/`, `web/src/**/*.test.*`, `e2e/`, Lighthouse config | Read, Write, Edit, Bash, Grep, Glob |
| devops | haiku | Makefile, compose, Dockerfiles, lefthook, commitlint, CI, Caddy, flags, `.env.example` | Read, Write, Edit, Bash, Grep, Glob, WebFetch, WebSearch |
| reviewer | opus | nothing; read-only adversarial review | Read, Grep, Glob, Bash (read-only) |

**Note**: custom agent types were not spawnable mid-session (the harness loads agent types at session start). Subagents therefore ran as `general-purpose` agents with the same model and their definition file as instructions. See `../ai-log.md`.
