# OneYield

Institutional lending UI (Vite + React) and **NestJS API** for Hedera: queued contract execution, Mirror Node indexer, JWT wallet auth, oracle cron.

## Structure

- `src/` — Frontend (role dashboards, TanStack Query, HashConnect-ready wallet flow)
- `backend/` — NestJS API ([backend/README.md](backend/README.md))
- `docker-compose.yml` — Postgres + Redis for local API development
- `docs/E2E-TESTNET.md` — Testnet E2E checklist

## Frontend

```bash
cp .env.example .env.local
npm install
npm run dev
```

- Without `VITE_API_URL`, the app uses **mock data** (and optional `VITE_USE_MOCK_WALLET=true` for JWT bypass).
- With `VITE_API_URL`, connect **HashPack** to sign the auth challenge (or set `VITE_USE_MOCK_WALLET=true` for local UI-only dev).

## Backend

See [backend/README.md](backend/README.md). Use Node **18+** for Hedera SDK and Vite tooling.

```bash
docker compose up -d
cd backend && cp .env.example .env && npm install && npm run start:dev
```

## Contracts

Solidity sources live in `oneYield-contracts` (separate repo path on your machine). Set `FACTORY_CONTRACT_ID` in `backend/.env`.
