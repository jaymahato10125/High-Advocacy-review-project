import path from 'node:path';
import { fileURLToPath } from 'node:url';
import mysql from 'mysql2/promise';
import { drizzle } from 'drizzle-orm/mysql2';
import { migrate } from 'drizzle-orm/mysql2/migrator';

const apiRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

// Recreates the test database from scratch and applies every migration
// (including the custom FULLTEXT one), so the suite always runs against the
// real schema — no test-only shortcuts.
export default async function setup() {
  const testUrl = new URL(
    process.env.DATABASE_URL ?? 'mysql://root:proofdesk@localhost:3306/proof_desk_test',
  );
  const dbName = testUrl.pathname.replace(/^\//, '');

  const admin = await mysql.createConnection({
    host: testUrl.hostname,
    port: Number(testUrl.port || 3306),
    user: decodeURIComponent(testUrl.username),
    password: decodeURIComponent(testUrl.password),
  });
  await admin.query(`DROP DATABASE IF EXISTS \`${dbName}\``);
  await admin.query(`CREATE DATABASE \`${dbName}\``);
  await admin.end();

  const conn = await mysql.createConnection(testUrl.toString());
  const db = drizzle(conn);
  await migrate(db, {
    migrationsFolder: path.join(apiRoot, 'src/db/migrations'),
  });
  await conn.end();
}
