import { drizzle } from 'drizzle-orm/mysql2';
import mysql from 'mysql2/promise';
import * as schema from './schema.js';

export const DATABASE_URL =
  process.env.DATABASE_URL ?? 'mysql://root:proofdesk@localhost:3306/proof_desk';

// Pool sized for an internal ops tool; connectionLimit becomes a real tuning
// knob only at 10x reviewer concurrency (implementation plan §13).
export const pool = mysql.createPool({
  uri: DATABASE_URL,
  connectionLimit: 10,
  waitForConnections: true,
  enableKeepAlive: true,
  // DATETIME <-> JS Date conversion handled by the driver; the app treats all
  // timestamps as server-local wall clock, serialized to ISO at the boundary.
  dateStrings: false,
});

export const db = drizzle(pool, { schema, mode: 'default' });
