# 0011. Category list mapped to Schedule C

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
The vendor accepts any category string (trap 3). Members are self-employed, so categories should help with taxes (ADR 0012).

## Options
- **Short generic list**: simple; no tax meaning
- **Schedule C-mapped list of 16 (chosen)**: tax-aware, drives the set-aside; longer list to choose from
- **Full Schedule C lines**: most precise; overwhelming for members

## Decision
16 categories: `income, transfer, personal, software, meals, travel, office, advertising, contractors, professional_services, insurance, utilities, rent, equipment, fees, other`. Each has a label, Schedule C line and `deductible_fraction` (meals 0.5; personal, transfer, income 0). Unknown synced categories are accepted on read and shown; writes are validated.

## Consequences
The list is served by `GET /api/categories`. Net-negative categories (trap 23) and transfers (trap 12) are handled in money rules.
