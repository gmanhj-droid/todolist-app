import pg from 'pg';
import { env } from './env.js';

const { Pool } = pg;

const pool = new Pool({
  connectionString: env.databaseUrl,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

pool.on('error', (err) => {
  console.error('Unexpected error on idle database client:', err.message);
});

/**
 * Execute a parameterized SQL query against the connection pool.
 * @param {string} text - SQL query string
 * @param {Array} [params] - Query parameters
 * @returns {Promise<pg.QueryResult>}
 */
export const db = {
  query: (text, params) => pool.query(text, params),

  /**
   * Acquire a client from the pool for use in transactions.
   * Caller is responsible for calling client.release().
   * @returns {Promise<pg.PoolClient>}
   */
  getClient: () => pool.connect(),
};

/**
 * Verify the database connection is reachable.
 * Throws if the connection cannot be established.
 */
export async function testConnection() {
  const client = await pool.connect();
  try {
    await client.query('SELECT 1');
    console.log('Database connection established successfully.');
  } finally {
    client.release();
  }
}

export default pool;
