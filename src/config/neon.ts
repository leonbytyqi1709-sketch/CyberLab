import { Pool } from 'pg';
import dotenv from 'dotenv';

dotenv.config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false, // Required for Neon.tech if not using certificates
  },
});

export const testDbConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('[database]: Successfully connected to Neon.tech PostgreSQL');
    const res = await client.query('SELECT NOW()');
    console.log('[database]: Server time:', res.rows[0].now);
    client.release();
  } catch (err) {
    console.error('[database]: Connection error', err);
    process.exit(1); // Exit if DB connection fails
  }
};

export default pool;
