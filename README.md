# Ledger

Start with `PROMPT.md`, then `CONTRACT.md`.

```
docker compose up --build
```

| Service | URL | What |
|---|---|---|
| web | http://localhost:5173 | React + TypeScript (Vite) |
| api | http://localhost:8000/api/ping | Django + DRF |
| vendor | http://localhost:8080/v1/transactions | Ledgerly (do not edit) |
| db | localhost:5433 | Postgres 16, user/password/db `ledger` |

On Windows, ask your AI assistant to adapt any command for PowerShell.

Run Django commands: `docker compose exec api python manage.py <command>`.
