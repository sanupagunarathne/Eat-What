import { randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import pg from "pg";

export async function testDatabase() {
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
    await admin.query(sql.replace("public.rooms", `"${schema}".rooms`));
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
