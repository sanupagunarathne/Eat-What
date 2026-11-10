import { pool } from "../db.js";

try {
  await pool.query("SELECT 1");
  console.log("PostgreSQL connection verified.");
} catch {
  console.error(
    "Database connection failed. Check DATABASE_URL and network access.",
  );
  process.exitCode = 1;
} finally {
  await pool.end();
}
