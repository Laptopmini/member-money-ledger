---
name: adr
description: Create a new Architecture Decision Record in docs/decisions from the template, numbered sequentially. Use when a decision is made with the owner, or when asked to "write an ADR" / "record this decision".
---

# New ADR

1. Find the next number: `ls docs/decisions | sort | tail -1` (+1, four digits).
2. Copy `docs/decisions/0000-template.md` to `docs/decisions/NNNN-<kebab-slug>.md`.
3. Fill every section: Status (Proposed/Accepted/Superseded by NNNN), Date (UTC today), Deciders
   (who chose, who proposed options), Context (the concrete problem, with file paths or trap
   numbers), Options (each with pros and cons, at least two), Decision, Consequences (including
   what we gave up and how we'd revisit it).
4. If it supersedes or amends an ADR or an `AGENTS.md` rule, update that one's Status line and the
   rule text in the same commit.
5. Commit alone: `docs(decisions): add ADR NNNN <slug>`.
