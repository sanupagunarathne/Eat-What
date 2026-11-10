// Run the same room behavior checks against the original PostgreSQL schema.
// Node's test runner isolates this worker from the JSONB schema tests.
process.env.EATWHAT_TEST_LEGACY_ROOMS = "true";
await import("./rooms.test.js");
