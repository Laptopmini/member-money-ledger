# 0012. Tax set-aside rate and IRS periods

- **Status**: Accepted
- **Date**: 2026-11-27 (Decided at T0 in the build session; the owner picked the recommended option.)
- **Deciders**: Owner (choice), Claude (options)

## Context
Self-employed members under-save for quarterly estimated taxes. The estimate should reward categorizing expenses.

## Options
- **25% of estimated profit, member-editable (chosen)**: simple and explainable
- **30%**: safer; overstates for many members
- **Computed SE tax + brackets**: accurate; needs filing status and income data we lack

## Decision
25% of estimated profit (income minus deductible expenses using per-category fractions), editable. IRS periods and due dates: Jan-Mar -> Apr 15, Apr-May -> Jun 15, Jun-Aug -> Sep 15, Sep-Dec -> Jan 15 of the next year (trap 20).

## Consequences
Limitation: due dates are not shifted for weekends or holidays. The figure is an estimate, not tax advice. Behind the `tax-set-aside` flag.
