# Collective take-home: Product Engineer

You are a product engineer on Collective's **Member Money** team. Our members are self-employed business owners. They connect their bank accounts through a vendor, **Ledgerly**, and use our app to understand where their money goes.

This folder is a small version of that setup. Ledgerly runs in `vendor/`. A starter Django API and React app are wired to it. Run:

```
docker compose up --build
```

Then open http://localhost:5173. You should see 5 transactions.

## What to build

We're hiring builders. Treat this like a real product: a member should be able to use it without explanation. We don't expect polished design, but we do expect you to have thought about the experience.

1. **Transactions page.** List a member's transactions, filter by category and date range.
2. **Monthly summary.** Spend, income, and spend by category for a chosen month.
3. **Recategorize.** A member can change a transaction's category. It's saved to Ledgerly and shows up everywhere.
4. **Your idea.** Pick one problem a self-employed member has with their money and solve it in the app. Tell us why you picked it.

Your API must expose these two endpoints (the rest is up to you):

| Endpoint | Returns |
|---|---|
| `GET /api/transactions` | The member's transactions. Your design. |
| `GET /api/summary?month=YYYY-MM` | That month's spend, income and spend by category. |

## Rules

- **Ledgerly is a third party.** Don't edit `vendor/`. Its contract is in `CONTRACT.md` and it will not change.
- Change anything else: models, structure, libraries, the starter code.
- Use any AI tools you like.
- Plan for 1 to 2 hours. Unfinished is fine; tell us what you'd do next.

## Send back

A zip of this folder (keep `.git` if you used it, skip `node_modules`) with a `NOTES.md` that covers:

- What you built, and the decisions you made
- Your idea from #4: the problem, why it matters, how you'd know it worked
- Where AI helped, and where it was wrong
- What you'd do with another day

## On-site

Bring your laptop with this project running. You'll show us what you built (about 20 minutes, no slides needed). Then we'll talk through your decisions, challenge some assumptions, and build on it together.
