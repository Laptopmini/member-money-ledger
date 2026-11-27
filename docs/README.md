# Docs index

| File | What |
|---|---|
| [process/00-initial-prompt.md](process/00-initial-prompt.md) | The initial prompt, verbatim |
| [process/01-prompt-formulation.md](process/01-prompt-formulation.md) | How the prompt was written; traps and decisions D1-D10 |
| [process/02-plan.md](process/02-plan.md) | Staged plan with checkboxes; decisions D11-D20 |
| [process/03-execution-log.md](process/03-execution-log.md) | Timestamped log against T0 |
| [process/roles.md](process/roles.md) | Owner, main session, subagents, Claude Design |
| [decisions/0000-template.md](decisions/0000-template.md) | ADR template |
| [decisions/](decisions/) | ADRs 0001-0020, one decision each |
| [design/handoff/](design/handoff/) | What was sent to Claude Design |
| [traps.md](traps.md) | Trap register: what could go wrong, handling, test |
| [ai-log.md](ai-log.md) | Where AI helped and where it was wrong |
| [security.md](security.md) | Threat model, controls, known gaps |

## How to read the history

- `git log --reverse --oneline` is the timeline.
- The execution log has timestamps relative to T0.
- ADRs explain why each decision was made (0001-0010 before T0, 0011-0020 at T0).
- `traps.md` explains what could go wrong and which test covers it.
- `ai-log.md` records where AI helped and where it was wrong.
