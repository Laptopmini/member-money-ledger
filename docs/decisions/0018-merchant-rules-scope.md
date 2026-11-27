# 0018. Merchant rules scope

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
A member should not recategorize the same merchant repeatedly (Could tier, flag `merchant-rules`).

## Options
- **Exact normalized merchant, uncategorized rows now and future (chosen)**: predictable, never overwrites choices
- **All matching rows**: more coverage; overwrites explicit choices
- **One-shot only**: simple; does not help future rows

## Decision
Rule on exact normalized merchant, both directions; applies to that merchant's uncategorized rows now and to future uncategorized synced rows; never overwrites explicit choices.

## Consequences
Fuzzy merchant matching is out of scope. Rule application writes through to the vendor and is audited.
