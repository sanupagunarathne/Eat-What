import pg from "pg";

if (!process.env.DATABASE_URL) {
  throw new Error("DATABASE_URL is required. Set it in .env.");
}

let pool;
try {
  pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
    connectionTimeoutMillis: 15000,
  });
} catch {
  throw new Error("Invalid DATABASE_URL configuration.");
}
export { pool };
// Qualify tables so a pooled connection's search_path cannot redirect queries.
const testSchema = process.env.EATWHAT_TEST_SCHEMA;
if (testSchema && !/^test_[a-f0-9]{32}$/.test(testSchema)) {
  throw new Error("Invalid test database schema.");
}
export const roomsTable = testSchema ? `"${testSchema}".rooms` : "public.rooms";
// Never log driver errors, which can contain connection details.
pool.on("error", () => console.error("Unexpected database connection error."));
