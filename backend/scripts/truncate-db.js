const { Client } = require('pg');
require('dotenv').config();

async function truncate() {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    user: process.env.DATABASE_USER || 'oneyield',
    password: process.env.DATABASE_PASSWORD || 'oneyield',
    database: process.env.DATABASE_NAME || 'oneyield',
  });

  try {
    await client.connect();
    console.log('Connected to database. Truncating tables...');
    
    // Ordered to handle potential FK constraints if CASCADE isn't enough or to be explicit
    const tables = [
      'borrower_pools',
      'lender_positions',
      'transactions',
      'pool_drafts',
      'pools',
      'aum_history',
      'queue_jobs',
      'contract_registry',
      'borrower_wallets'
    ];

    for (const table of tables) {
      try {
        await client.query(`TRUNCATE TABLE "${table}" CASCADE;`);
        console.log(`Truncated table: ${table}`);
      } catch (e) {
        console.warn(`Could not truncate table ${table}: ${e.message}`);
      }
    }

    console.log('Successfully truncated all relevant tables.');
  } catch (err) {
    console.error('Error truncating tables:', err);
  } finally {
    await client.end();
  }
}

truncate();
