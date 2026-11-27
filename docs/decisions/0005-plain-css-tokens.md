# 0005. Plain CSS with custom-property tokens

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided in prompt formulation, before T0.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Claude Design hands back a visual design; we need light/dark, mobile-first, WCAG 2.2 AA and Lighthouse >= 0.95.

## Options
- **Plain CSS + tokens**: maps 1:1 to the design handback, minimal JS, best for Lighthouse; discipline needed
- **Tailwind v4**: fast to write; utility classes diverge from the design tokens and add build config
- **Component library**: fast widgets; bundle weight, theming friction, generic look

## Decision
Plain CSS with custom-property tokens, light/dark through `prefers-color-scheme` plus a persisted toggle, no chart library (CSS bars), system font stack.

## Consequences
Applying the handback is mostly replacing token values. We build every component ourselves and must test accessibility (axe in E2E).
