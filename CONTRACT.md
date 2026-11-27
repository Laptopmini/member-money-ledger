# Ledgerly API contract

Base URL inside Docker: `http://vendor:8080`. From your machine: `http://localhost:8080`.

This contract will not change.

## Transaction

```json
{
  "id": "txn_000001",
  "account_id": "acc_checking",
  "posted_on": "2026-10-28",
  "amount_cents": 4599,
  "direction": "debit",
  "currency": "USD",
  "merchant": "Blue Bottle Coffee",
  "category": "meals",
  "description": "Client coffee",
  "status": "posted",
  "updated_at": "2026-10-28T15:02:11Z"
}
```

| Field | Type | Notes |
|---|---|---|
| `id` | string | Unique, stable |
| `account_id` | string | |
| `posted_on` | string | `YYYY-MM-DD`, the member's local date |
| `amount_cents` | integer | Always positive. Use `direction` for sign. |
| `direction` | `"debit"` or `"credit"` | Debit is money out, credit is money in (income or refund) |
| `currency` | string | ISO 4217. Expect `USD`. |
| `merchant` | string | |
| `category` | string or `null` | `null` means uncategorized |
| `description` | string | Free text |
| `status` | `"pending"` or `"posted"` | A pending row can later post with the same `id` and changes |
| `updated_at` | string | ISO 8601 UTC. Changes whenever the row changes. |

## Endpoints

| Method | Path | Body | Success |
|---|---|---|---|
| GET | `/health` | | `200 {"status": "ok"}` |
| GET | `/v1/transactions?limit=&cursor=` | | `200 {"data": [Transaction], "next_cursor": string or null}` |
| GET | `/v1/transactions/{id}` | | `200 Transaction` |
| POST | `/v1/transactions` | `account_id, posted_on, amount_cents, direction, merchant`, optional `category, description` | `201 Transaction` |
| PUT | `/v1/transactions/{id}` | Only `category` and/or `description` | `200 Transaction` |
| DELETE | `/v1/transactions/{id}` | | `204` |

## Pagination

- `limit` defaults to 50, max 100.
- Pass `next_cursor` back as `cursor` for the next page. `null` means the last page.
- Order is newest `posted_on` first.

## Errors

```json
{ "error": { "code": "not_found", "message": "Transaction txn_000099 not found." } }
```

| Status | Code | Meaning |
|---|---|---|
| 400 | `bad_request` | Malformed query or body |
| 404 | `not_found` | Unknown id or route |
| 422 | `invalid` | Missing or read-only fields |
