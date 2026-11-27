# Member Money Ledger

A ledger for self-employed members: see where money goes, recategorize transactions (saved
to the bank-data vendor, Ledgerly), and know how much to set aside for quarterly taxes.

Start with `PROMPT.md` (the brief) and `NOTES.md` (what we built and why).

## Quick start

**Prerequisites:** Docker with Compose v2, `make`. Node 24+ on the host only for E2E tests.

```sh
make up          # docker compose up --build (dev, hot reload)
```

Open **http://localhost:5173**. The app opens on the current month. The vendor's sample
data is October 2026, so click **Jump to October 2026**, or load three months of demo data:

```sh
make reset-demo SEED=1   # restart the vendor, clear the mirror, POST ~60 demo rows, sync
```

| Service | URL | What |
|---|---|---|
| web (dev) | http://localhost:5173 | React + TypeScript (Vite), hot reload |
| api | http://localhost:8000/api/health | Django + DRF. Swagger UI at `/api/docs` in dev |
| web (prod profile) | http://localhost:8081 | `make prod`: built app behind Caddy, gunicorn API |
| vendor | http://localhost:8080/v1/transactions | Ledgerly stand-in (**do not edit `vendor/`**) |
| flagd | http://localhost:8016 | Feature flags (OpenFeature, OFREP) |
| db | localhost:5433 | Postgres, user/password/db `ledger` |

`make help` lists every command. On Windows, run the `docker compose` commands from the
Makefile directly in PowerShell.

## More

- `AGENTS.md`: layout, commands and the product rules every change must respect
- `docs/README.md`: the process, decisions (ADRs), trap register, AI log and security model
