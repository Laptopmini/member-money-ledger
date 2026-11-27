# Categories

Writes are validated against this list. Categories outside it can arrive from the bank feed:
show them with their raw key (e.g. "Groceries"), so the design needs a neutral "other source"
chip style. `null` = **Uncategorized** (its own first-class bucket, distinct style).

| Key | Label | Schedule C line | Deductible | Notes |
|---|---|---|---|---|
| `income` | Income | 1 Gross receipts | — | Only credits here count as income |
| `transfer` | Transfer | — | 0% | Between the member's own accounts; excluded from spend and income |
| `personal` | Personal | — | 0% | Counts as spend, not deductible |
| `software` | Software & subscriptions | 18 Office expense / 27a | 100% | |
| `meals` | Meals | 24b Meals | 50% | |
| `travel` | Travel | 24a Travel | 100% | |
| `office` | Office supplies | 18 Office expense | 100% | |
| `advertising` | Advertising | 8 Advertising | 100% | |
| `contractors` | Contractors | 11 Contract labor | 100% | |
| `professional_services` | Legal & professional | 17 Legal and professional | 100% | |
| `insurance` | Insurance | 15 Insurance | 100% | |
| `utilities` | Phone & internet | 25 Utilities | 100% | |
| `rent` | Rent & workspace | 20b Rent | 100% | |
| `equipment` | Equipment | 13 Depreciation / 22 Supplies | 100% | |
| `fees` | Bank & payment fees | 27a Other | 100% | |
| `other` | Other business | 27a Other | 100% | |

Each category may get a small inline SVG icon (optional, 16 px, monochrome via `currentColor`).
Colors for bars: use a small accessible categorical palette in tokens (both themes), but
never rely on color alone: labels are always visible.
