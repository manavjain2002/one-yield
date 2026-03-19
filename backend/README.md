# OneYield API

NestJS backend: Hedera contract execution (queued), Mirror Node indexer, JWT wallet auth, PostgreSQL, Redis/BullMQ, Socket.IO events, oracle cron.

## Prerequisites

- Node.js 18+
- PostgreSQL 16
- Redis 7

## Quick start

```bash
cd backend
cp .env.example .env
# Edit .env: database, redis, FACTORY_CONTRACT_ID, signer keys (testnet only)

# From repo root
docker compose up -d postgres redis

cd backend
npm install
npm run start:dev
```

- API: `http://localhost:3001`
- Health: `GET /health`
- WebSocket namespace: `/events` (same port; set `VITE_WS_URL=http://localhost:3001` on the frontend if using WS)

## Signer keys (dev)

Set `*_ACCOUNT_ID` and `*_PRIVATE_KEY` pairs for each role that will submit transactions. Dedicated borrower wallets: `DEDICATED_WALLETS_JSON=[{"accountId":"0.0.x","privateKey":"..."}]`.

**Never commit real keys.** Production: HashiCorp Vault / AWS Secrets Manager (replace `SignerService` loader).

## Main modules

| Module        | Responsibility                                      |
|---------------|-----------------------------------------------------|
| `AuthModule`  | `POST /auth/challenge`, `/auth/verify`, `/auth/role` |
| `PoolsModule` | Pools CRUD routes, borrower/lender/manager paths   |
| `QueueModule` | BullMQ `hedera-tx` worker + per-wallet sequencing   |
| `IndexerModule` | Mirror poll + event decode → Postgres            |
| `OracleModule` | Cron AUM bump (maintenance window aware)           |
| `ScreeningModule` | Chainalysis stub (`CHAINALYSIS_API_KEY`)       |

## Security (Phase 7)

- Global rate limit: `ThrottlerModule` (100/min default; stricter on tx routes).
- Stricter limits on `POST` pool/manager/borrower actions.
- `ChainalysisService` is a stub until API is wired.

## E2E (Phase 8)

With Postgres + Redis + `.env` configured:

```bash
cd backend
npm run test:e2e
```

Full on-chain E2E requires deployed factory/pool contracts on Hedera testnet and all signer env vars.
