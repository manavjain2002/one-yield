# Testnet E2E checklist (Phase 8)

1. **Infra**: `docker compose up -d` (Postgres + Redis). Configure `backend/.env`.
2. **Contracts**: Deploy `oneYieldFactory`, pool + fund manager implementations, set `FACTORY_CONTRACT_ID`.
3. **Roles**: Grant `ROLE_MANAGER`, pool manager, FM admin, oracle keys; whitelist pool token and pool manager on factory.
4. **Backend**: `npm run start:dev` — confirm indexer polls without mirror errors.
5. **Flow**:
   - Borrower: `POST /pools` (JWT) → wait indexer → `PATCH .../allocations` → Manager: `POST .../activate` → Lenders deposit via wallet → Manager `deploy-funds` → Borrower repay → Manager `send-to-reserve` → Lender withdraw.
6. **Load**: Enqueue 50+ `deposit` jobs (lender-side) while FM `deployFunds` runs — observe single-wallet sequencing.
7. **Oracle**: Run for 7 days; confirm `30 0 * * *` cron and maintenance window behavior.

## Load testing queue

Use a script or k6 to hit `POST /pools/:id/deploy-funds` with manager JWT (staging only). Monitor Redis queue depth and `queue_jobs` table.
