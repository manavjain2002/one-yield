const { Client } = require('pg');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');

async function addAdmin(username, password) {
  const client = new Client({
    host: process.env.DATABASE_HOST || 'localhost',
    port: process.env.DATABASE_PORT || 5432,
    user: process.env.DATABASE_USER || 'oneyield',
    password: process.env.DATABASE_PASSWORD || 'oneyield',
    database: process.env.DATABASE_NAME || 'oneyield',
  });

  try {
    await client.connect();
    
    // Hash password
    const saltRounds = 10;
    const passwordHash = await bcrypt.hash(password, saltRounds);
    
    const id = uuidv4();
    const now = new Date();

    const query = `
      INSERT INTO users (id, username, "passwordHash", role, "createdAt", "updatedAt")
      VALUES ($1, $2, $3, 'admin', $4, $5)
      ON CONFLICT (username) 
      DO UPDATE SET "passwordHash" = EXCLUDED."passwordHash", role = 'admin', "updatedAt" = $5
      RETURNING username;
    `;
    
    const res = await client.query(query, [id, username, passwordHash, now, now]);
    console.log(`Admin user '${res.rows[0].username}' added/updated successfully.`);
    
  } catch (err) {
    console.error('Error adding admin user:', err.message);
    process.exit(1);
  } finally {
    await client.end();
  }
}

const args = process.argv.slice(2);
const u = args[0] || 'admin';
const p = args[1] || 'oy-admin-password-456';

addAdmin(u, p);
