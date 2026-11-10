import { readFile } from "node:fs/promises";
import { getPool, closeDatabase } from "../db.js";
try {
  await getPool().query(
    await readFile(
      new URL("../migrations/001_rooms.sql", import.meta.url),
      "utf8",
    ),
  );
  console.log("Database schema ready.");
} catch (error) {
  console.error("Database initialization failed", {
    code: error.code || "CONFIGURATION_ERROR",
  });
  process.exitCode = 1;
} finally {
  await closeDatabase();
}
