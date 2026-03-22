/**
 * updateAUM.batch.js
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs the daily AUM update across multiple pools in sequence.
 * Each pool is processed independently — a failure on one pool logs the error
 * and continues to the next rather than aborting the entire run.
 *
 * Usage:
 *   node scripts/updateAUM.batch.js [--dry-run]
 *
 * Environment variables (in .env):
 *   ORACLE_PRIVATE_KEY   — private key of the service wallet (oracle manager)
 *   RPC_URL              — JSON-RPC endpoint
 *   DATABASE_*           — DB connection parameters
 *   MAX_DAILY_BPS        — (optional) safety cap on daily increase, default 200
 * ─────────────────────────────────────────────────────────────────────────────
 */

'use strict';

require('dotenv').config();
const { ethers } = require('ethers');
const { Client } = require('pg');

// ── CLI ───────────────────────────────────────────────────────────────────────
const isDryRun = process.argv.includes('--dry-run');

// ── Config ────────────────────────────────────────────────────────────────────
const RPC_URL     = process.env.RPC_URL;
const PRIVATE_KEY = process.env.ORACLE_PRIVATE_KEY;
const MAX_DAILY_BPS = Number(process.env.MAX_DAILY_BPS || 200);

// ── ABI ───────────────────────────────────────────────────────────────────────
const POOL_ABI = [
  'function status() external view returns (uint8)',
  'function projectedAPY() external view returns (uint256)',
  'function assetUnderManagement() external view returns (uint256)',
  'function AUMLastUpdatedAt() external view returns (uint64)',
  'function AUMUpdateCooldownPeriod() external view returns (uint64)',
  'function AUMChangeThresholdPercentage() external view returns (uint64)',
  'function paused() external view returns (bool)',
  'function pause() external',
  'function unpause() external',
  'function updateAssetUnderManagement(uint256) external',
  'function hasRole(bytes32 role, address account) external view returns (bool)',
  'function ROLE_ORACLE_MANAGER() external view returns (bytes32)',
];

// ── Logger ────────────────────────────────────────────────────────────────────
const ts   = () => new Date().toISOString();
const log  = (...a) => console.log(`[INFO]  ${ts()}`, ...a);
const ok   = (...a) => console.log(`[OK]    ${ts()}`, ...a);
const warn = (...a) => console.warn(`[WARN]  ${ts()}`, ...a);
const err  = (...a) => console.error(`[ERROR] ${ts()}`, ...a);

// ── Helpers ───────────────────────────────────────────────────────────────────
function calcDailyAUM(currentAUM, projectedAPY) {
  if (currentAUM === 0n) return 0n;
  return currentAUM + (currentAUM * projectedAPY) / (10000n * 365n);
}

function fmt(wei) {
  return ethers.formatUnits(wei, 18);
}

async function sendAndWait(txPromise, label, timeout = 120_000) {
  const tx = await txPromise;
  log(`${label} → ${tx.hash}`);
  const receipt = await Promise.race([
    tx.wait(),
    new Promise((_, rej) =>
      setTimeout(() => rej(new Error(`${label} timed out`)), timeout)
    ),
  ]);
  if (receipt.status !== 1) throw new Error(`${label} reverted. Hash: ${tx.hash}`);
  ok(`${label} confirmed (block ${receipt.blockNumber})`);
  return receipt;
}

// ── DB ────────────────────────────────────────────────────────────────────────
async function getActivePoolAddresses() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    user: process.env.DATABASE_USER || 'oneyield',
    password: process.env.DATABASE_PASSWORD || 'oneyield',
    database: process.env.DATABASE_NAME || 'oneyield',
  });

  try {
    await client.connect();
    const res = await client.query("SELECT \"contractAddress\" FROM \"pools\" WHERE \"status\" = 'active'");
    return res.rows.map(row => row.contractAddress);
  } catch (e) {
    err('Database connection failed:', e.message);
    throw e;
  } finally {
    await client.end();
  }
}

// ── Per-pool update ───────────────────────────────────────────────────────────
async function updatePool(pool, address, walletAddr) {
  log(`── Pool ${address} ──`);

  // Role check
  const ROLE = await pool.ROLE_ORACLE_MANAGER();
  if (!(await pool.hasRole(ROLE, walletAddr))) {
    throw new Error(`Wallet ${walletAddr} missing ROLE_ORACLE_MANAGER on ${address}`);
  }

  // Read state
  const [
    statusRaw, projectedAPY, currentAUM,
    lastUpdated, cooldown, threshold, isPaused,
  ] = await Promise.all([
    pool.status(), pool.projectedAPY(), pool.assetUnderManagement(),
    pool.AUMLastUpdatedAt(), pool.AUMUpdateCooldownPeriod(),
    pool.AUMChangeThresholdPercentage(), pool.paused(),
  ]);

  if (Number(statusRaw) !== 1) throw new Error(`Pool not ACTIVE (status=${statusRaw})`);
  if (currentAUM === 0n) { warn(`${address}: AUM is 0, skipping.`); return null; }

  // Cooldown check
  const now     = BigInt(Math.floor(Date.now() / 1000));
  const elapsed = now - lastUpdated;
  if (elapsed < cooldown) {
    const rem = Number(cooldown - elapsed);
    throw new Error(`Cooldown not elapsed — ${rem}s remaining`);
  }

  // Compute new AUM
  const newAUM     = calcDailyAUM(currentAUM, projectedAPY);
  const increase   = newAUM - currentAUM;
  const increaseBps = Number((increase * 10000n) / currentAUM);

  // Threshold guard (contract-side)
  const contractMax = (currentAUM * threshold) / 10000n;
  if (newAUM > contractMax) {
    throw new Error(`New AUM ${fmt(newAUM)} exceeds contract threshold ${fmt(contractMax)}`);
  }

  // Safety cap
  if (increaseBps > MAX_DAILY_BPS) {
    throw new Error(`Daily increase ${increaseBps} bps exceeds safety cap ${MAX_DAILY_BPS} bps`);
  }

  log(`  APY ${Number(projectedAPY) / 100}%  |  AUM ${fmt(currentAUM)} → ${fmt(newAUM)} (+${fmt(increase)})`);

  if (isDryRun) {
    warn(`  DRY-RUN: would pause → updateAUM(${fmt(newAUM)}) → unpause`);
    return { dryRun: true, address, currentAUM, newAUM, increase };
  }

  // Pause
  if (!isPaused) await sendAndWait(pool.pause(), 'pause()');
  else warn(`  Already paused — skipping pause()`);

  // Update AUM
  let receipt;
  try {
    receipt = await sendAndWait(
      pool.updateAssetUnderManagement(newAUM),
      'updateAssetUnderManagement()'
    );
  } catch (e) {
    err(`  updateAssetUnderManagement failed — recovering with unpause...`);
    try { await sendAndWait(pool.unpause(), 'unpause() [recovery]'); } catch (_) {}
    throw e;
  }

  // Unpause
  await sendAndWait(pool.unpause(), 'unpause()');

  return { address, currentAUM, newAUM, increase, txHash: receipt.hash, block: receipt.blockNumber };
}

// ── Main ──────────────────────────────────────────────────────────────────────
async function main() {
  log('='.repeat(60));
  log('oneYield — Batch Daily AUM Update');
  if (isDryRun) warn('DRY-RUN mode enabled. No transactions will be sent.');
  log('='.repeat(60));

  if (!RPC_URL)     throw new Error('RPC_URL not set.');
  if (!PRIVATE_KEY) throw new Error('ORACLE_PRIVATE_KEY not set.');

  const poolAddresses = await getActivePoolAddresses();
  if (poolAddresses.length === 0) {
    ok('No active pools found in database. Exiting.');
    return;
  }

  const provider = new ethers.JsonRpcProvider(RPC_URL);
  const wallet   = new ethers.Wallet(PRIVATE_KEY, provider);
  const network  = await provider.getNetwork();

  log(`Wallet  : ${wallet.address}`);
  log(`Network : ${network.name} (chainId ${network.chainId})`);
  log(`Pools   : ${poolAddresses.length}`);

  const results = { success: [], failed: [] };

  for (const address of poolAddresses) {
    const poolContract = new ethers.Contract(address, POOL_ABI, wallet);
    try {
      const result = await updatePool(poolContract, address, wallet.address);
      if (result) results.success.push(result);
    } catch (e) {
      err(`Pool ${address} FAILED: ${e.message}`);
      results.failed.push({ address, error: e.message });
    }
    log('');
  }

  // ── Final summary ────────────────────────────────────────────────────────────
  log('='.repeat(60));
  log(`Batch complete.  Success: ${results.success.length}  Failed: ${results.failed.length}`);
  if (results.success.length > 0) {
    log('Successful pools:');
    for (const r of results.success) {
      if (r.dryRun) {
        log(`  [DRY-RUN] ${r.address}  +${fmt(r.increase)}`);
      } else {
        log(`  ${r.address}  ${fmt(r.currentAUM)} → ${fmt(r.newAUM)}  tx: ${r.txHash}`);
      }
    }
  }
  if (results.failed.length > 0) {
    err('Failed pools:');
    for (const r of results.failed) err(`  ${r.address}: ${r.error}`);
    process.exit(1);
  }
  log('='.repeat(60));
}

main().catch((e) => {
  err(e.message || e);
  process.exit(1);
});
