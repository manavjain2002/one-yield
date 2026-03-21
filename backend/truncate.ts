import { DataSource } from 'typeorm';

const ds = new DataSource({
  type: 'postgres',
  host: '127.0.0.1',
  port: 5432,
  username: 'oneyield',
  password: 'oneyield',
  database: 'oneyield',
});

async function run() {
  await ds.initialize();
  const tables = await ds.query(`SELECT tablename FROM pg_tables WHERE schemaname = 'public';`);
  for (const t of tables) {
    console.log('Truncating', t.tablename);
    await ds.query(`TRUNCATE TABLE "${t.tablename}" CASCADE;`);
  }
  await ds.destroy();
}
run().catch(console.error);
