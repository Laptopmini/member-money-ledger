# AI log

Appended live: where AI helped and where it was wrong, with specifics. Newest at the bottom.

| Time (UTC) | Who | Helped / Wrong | What | How caught / fixed |
|---|---|---|---|---|
| 18:20 | main (Opus) | Helped | Found 14 traps at T0 that the pre-session analysis missed, including that settled rule #7 (`>=` upsert) contradicts rule #11 after a vendor restart | Owner accepted ADR 0019 |
| 18:30 | main (Opus) | Wrong (tooling) | Assumed newly written `.claude/agents/*.md` would be spawnable mid-session; the harness only loads agent types at session start | Spawned `general-purpose` with the definition's model and told it to read its definition file |
