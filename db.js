import pg from "pg";
let pool;
export function getPool() {
  if (!process.env.DATABASE_URL) throw new Error("DATABASE_URL is required");
  if (!pool) {
    pool = new pg.Pool({
      connectionString: process.env.DATABASE_URL,
      max: 3,
      connectionTimeoutMillis: 5000,
      idleTimeoutMillis: 10000,
      statement_timeout: 10000,
      idle_in_transaction_session_timeout: 10000,
      allowExitOnIdle: true,
    });
    pool.on("error", (error) =>
      console.error("Database pool error", { code: error.code }),
    );
  }
  return pool;
}
export async function closeDatabase() {
  if (pool) {
    await pool.end();
    pool = undefined;
  }
}
export const roomStore = {
  async create(room) {
    const result = await getPool().query(
      "INSERT INTO rooms (code, data) VALUES ($1, $2::jsonb) ON CONFLICT (code) DO NOTHING",
      [room.code, JSON.stringify(room)],
    );
    return result.rowCount === 1;
  },
  async get(code) {
    const result = await getPool().query(
      "SELECT data FROM rooms WHERE code = $1",
      [code],
    );
    return result.rows[0]?.data;
  },
  async update(code, mutate) {
    const client = await getPool().connect();
    let broken = false;
    try {
      await client.query("BEGIN");
      const result = await client.query(
        "SELECT data FROM rooms WHERE code = $1 FOR UPDATE",
        [code],
      );
      const room = result.rows[0]?.data;
      const response = mutate(room);
      await client.query(
        "UPDATE rooms SET data = $2::jsonb, updated = now() WHERE code = $1",
        [code, JSON.stringify(room)],
      );
      await client.query("COMMIT");
      return response;
    } catch (error) {
      try {
        await client.query("ROLLBACK");
      } catch {
        broken = true;
      }
      throw error;
    } finally {
      client.release(broken);
    }
  },
};
