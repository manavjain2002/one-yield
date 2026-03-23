# OneYield API (NestJS)

This folder is the **NestJS** backend for OneYield. For product overview, architecture, user flows, deployment, and frontend documentation, see the **[root README.md](../README.md)**.

---

## Quick start

**Prerequisites:** Node.js **20+**, PostgreSQL **16**, Redis **7**.

```bash
# From repository root — Postgres + Redis
docker compose up -d

cd backend
cp .env.example .env
# Edit .env: database, redis, JWT, CORS, RPC, factory/token addresses, signer keys (testnet only)

npm install
npm run start:dev
```

- **API:** `http://localhost:3001`
- **Health:** `GET /health`
- **WebSocket:** namespace `/events` on the same port (configure `VITE_WS_URL` on the frontend to this origin)

---

## API modules (reference)

| Module | Responsibility |
|--------|----------------|
| `AuthModule` | `POST /auth/challenge`, `/auth/verify`, `/auth/role`, `/auth/login`, `/auth/register`, `/auth/refresh`, `GET /auth/username-available` |
| `PoolsModule` | Pool CRUD and role-scoped routes under `/pools`, `/borrower`, `/lender`, `/manager`, `/admin` ([`src/pools/pools.controller.ts`](src/pools/pools.controller.ts)) |
| `QueueModule` | BullMQ worker + per-wallet sequencing ([`src/queue/tx.processor.ts`](src/queue/tx.processor.ts)) |
| `ContractsModule` | ethers.js contract helpers for queued txs |
| `OracleModule` | Cron + `POST /admin/oracle/run-aum-update` ([`src/oracle/oracle.controller.ts`](src/oracle/oracle.controller.ts)) |
| `WebsocketModule` | Socket.IO `/events` gateway |
| `ScreeningModule` | Chainalysis stub (`CHAINALYSIS_API_KEY`) |

There is **no** separate Mirror Node indexer Nest module; the app relies on **`POST /pools/confirm-tx`**, **`POST /pools/record-activity`**, and queue receipts to stay consistent with chain state (see root README).

---

## Signer keys (development)

Set platform `*_PRIVATE_KEY` values in `.env` for roles that submit transactions via the queue. **Never commit real keys.** In production, load secrets from HashiCorp Vault, AWS Secrets Manager, or your host’s secret store.

Optional `DEDICATED_WALLETS_JSON` is documented in [`.env.example`](.env.example).

---

## Security

- Global rate limit: `ThrottlerModule` (100/min default; stricter limits on selected routes; see root README).
- `ChainalysisService` remains a stub until a real API is wired.

---

## Tests

```bash
cd backend
npm run test
npm run test:e2e
```

Full manual testnet flow: [../docs/E2E-TESTNET.md](../docs/E2E-TESTNET.md).
