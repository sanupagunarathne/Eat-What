import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

export async function testDatabase() {
  if (process.env.TEST_DATABASE_URL)
    process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error(
      "DATABASE_URL is required for PostgreSQL integration tests.",
    );
  }
  const schema = `test_${randomUUID().replaceAll("-", "")}`;
  const admin = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
  try {
    await admin.query(`CREATE SCHEMA "${schema}"`);
    const sql = await readFile(
      new URL("../migrations/001_rooms.sql", import.meta.url),
      "utf8",
    );
    const migration =
      process.env.EATWHAT_TEST_LEGACY_ROOMS === "true"
        ? `CREATE TABLE "${schema}".rooms (code TEXT PRIMARY KEY, data TEXT NOT NULL, updated BIGINT NOT NULL)`
        : sql.replace("public.rooms", `"${schema}".rooms`);
    await admin.query(migration);
  } catch {
    await admin.end();
    throw new Error(
      "Test database setup failed. Check DATABASE_URL and schema permissions.",
    );
  }
  return {
    schema,
    url: process.env.DATABASE_URL,
    async cleanup() {
      try {
        await admin.query(`DROP SCHEMA "${schema}" CASCADE`);
      } finally {
        await admin.end();
      }
    },
  };
}
