import { test } from "node:test";
if (process.env.TEST_DATABASE_URL) {
  await import("./rooms.test.js");
} else {
  test(
    "PostgreSQL integration (set TEST_DATABASE_URL to an initialized test database)",
    { skip: true },
    () => {},
  );
}
