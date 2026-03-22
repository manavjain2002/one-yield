-- Run once against production/staging Postgres (TypeORM entity must match).
ALTER TABLE users
  ADD COLUMN IF NOT EXISTS "displayName" character varying(255),
  ADD COLUMN IF NOT EXISTS "email" character varying(255),
  ADD COLUMN IF NOT EXISTS "country" character varying(128);
