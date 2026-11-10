import { test, after } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
process.env.NODE_ENV = "test";
process.env.DATA_DIR = mkdtempSync(join(tmpdir(), "eatwhat-test-"));
const { server } = await import("../server.js");
await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
const base = `http://127.0.0.1:${server.address().port}`;
after(async () => {
  await new Promise((resolve) => server.close(resolve));
  rmSync(process.env.DATA_DIR, { recursive: true, force: true });
});
function person() {
  let cookie = "";
  return async (path, body, expectedStatus = 200, slow = false) => {
    const text = body === undefined ? undefined : JSON.stringify(body);
    const response = await fetch(base + "/api/rooms" + path, {
      method: body === undefined ? "GET" : "POST",
      headers: { cookie, "Content-Type": "application/json" },
      body: slow
        ? (async function* () {
            yield text.slice(0, 1);
            await new Promise((resolve) => setTimeout(resolve, 30));
            yield text.slice(1);
          })()
        : text,
      duplex: slow ? "half" : undefined,
    });
    cookie ||= response.headers.get("set-cookie")?.split(";")[0] || "";
    const data = await response.json();
    assert.equal(response.status, expectedStatus, data.error);
    return data;
  };
}
const settings = {
  name: "Alex",
  expected: 2,
  budget: 25000,
  distance: 3,
  cuisine: "Any",
  vegetarian: false,
};
async function table(overrides = {}) {
  const host = person(),
    guest = person();
  const room = await host("", { ...settings, ...overrides }, 201),
    path = `/${room.code}`;
  await guest(path + "/join", { name: "Sam" });
  return { host, guest, path, room };
}
test("host-defined count, full-room protection, membership, and readiness gate", async () => {
  const { host, guest, path } = await table();
  await person()(path, undefined, 403);
  await person()(path + "/join", { name: "Extra" }, 409);
  await guest(path + "/start", {}, 403);
  await host(path + "/start", {}, 409);
  await host(path + "/ready", { ready: true });
  await host(path + "/start", {}, 409);
  await guest(path + "/ready", { ready: true });
  const started = await host(path + "/start", {});
  assert.equal(started.phase, "voting");
  assert.equal(started.expected, 2);
});
test("unanimous match waits for every vote and does not expose private votes", async () => {
  const { host, guest, path, room } = await table();
  await host(path + "/ready", { ready: true });
  await guest(path + "/ready", { ready: true });
  await host(path + "/start", {});
  for (const meal of room.meals)
    await host(path + "/vote", { mealId: meal.id, yes: true });
  const waiting = await guest(path);
  assert.equal(waiting.phase, "voting");
  assert.equal(waiting.winner, null);
  assert.deepEqual(waiting.votedIds, []);
  assert.ok(waiting.members.every((m) => !("votes" in m) && !("id" in m)));
  for (const meal of room.meals)
    await guest(path + "/vote", { mealId: meal.id, yes: true });
  const result = await host(path);
  assert.equal(result.phase, "result");
  assert.equal(result.winner.id, room.meals[0].id);
  await guest(path + "/restart", {}, 403);
  const reset = await host(path + "/restart", {});
  assert.equal(reset.phase, "lobby");
  assert.deepEqual(reset.votedIds, []);
  assert.ok(reset.members.every((m) => !m.ready));
});
test("passing prevents a unanimous match and votes cannot be changed", async () => {
  const { host, guest, path, room } = await table();
  await host(path + "/ready", { ready: true });
  await guest(path + "/ready", { ready: true });
  await host(path + "/start", {});
  await host(path + "/vote", { mealId: room.meals[0].id, yes: true });
  await host(path + "/vote", { mealId: room.meals[0].id, yes: false }, 409);
  for (const meal of room.meals.slice(1))
    await host(path + "/vote", { mealId: meal.id, yes: true });
  for (const meal of room.meals)
    await guest(path + "/vote", { mealId: meal.id, yes: false });
  const result = await guest(path);
  assert.equal(result.phase, "result");
  assert.equal(result.winner, null);
});
test("filters enforce budget, distance, cuisine, and vegetarian preference", async () => {
  const room = await person()(
    "",
    {
      ...settings,
      budget: 4500,
      distance: 3,
      cuisine: "Indian",
      vegetarian: true,
    },
    201,
  );
  assert.deepEqual(
    room.meals.map((m) => m.id),
    ["dosa"],
  );
});
test("empty filtered menus become an explicit empty state", async () => {
  const { host, guest, path } = await table({
    budget: 3000,
    distance: 1,
    vegetarian: true,
  });
  await host(path + "/ready", { ready: true });
  await guest(path + "/ready", { ready: true });
  const result = await host(path + "/start", {});
  assert.equal(result.phase, "empty");
  assert.deepEqual(result.meals, []);
});
test("invalid configuration, names, codes, and votes are rejected", async () => {
  const client = person();
  await client("", null, 400);
  await client("", { ...settings, expected: 0 }, 400);
  const largeRoom = await client("", { ...settings, expected: 120 }, 201);
  assert.equal(largeRoom.expected, 120);
  await client("", { ...settings, budget: -5 }, 400);
  await client("", { ...settings, name: "" }, 400);
  await client("/ZZZZZZ/join", { name: "Sam" }, 404);
  const room = await client("", settings, 201);
  await client(`/${room.code}/vote`, { mealId: "biryani", yes: true }, 409);
});
test("refresh and repeat join preserve membership and do not duplicate a seat", async () => {
  const { guest, path } = await table();
  await guest(path + "/ready", { ready: true });
  const refreshed = await guest(path + "/join", { name: "Ignored duplicate" });
  assert.equal(refreshed.members.length, 2);
  assert.equal(refreshed.ready, true);
  assert.equal(refreshed.members.find((m) => m.me).name, "Sam");
});
test("static app and locally served images load with a security policy", async () => {
  const response = await fetch(base);
  assert.equal(response.status, 200);
  assert.match(
    response.headers.get("content-security-policy"),
    /default-src 'self'/,
  );
  assert.match(await response.text(), /EATWHAT/);
  for (const name of ["biryani", "pasta", "pizza", "burger", "dosa", "rice"]) {
    const image = await fetch(`${base}/images/${name}.jpg`);
    assert.equal(image.status, 200);
    assert.ok((await image.arrayBuffer()).byteLength > 1000);
  }
});

test("overlapping slow requests preserve both participants’ readiness and votes", async () => {
  const { host, guest, path, room } = await table();
  await Promise.all([
    host(path + "/ready", { ready: true }, 200, true),
    guest(path + "/ready", { ready: true }, 200, true),
  ]);
  assert.ok((await host(path)).members.every((m) => m.ready));
  await host(path + "/start", {});
  for (const meal of room.meals) {
    await Promise.all([
      host(path + "/vote", { mealId: meal.id, yes: true }, 200, true),
      guest(path + "/vote", { mealId: meal.id, yes: true }, 200, true),
    ]);
  }
  const result = await host(path);
  assert.equal(result.phase, "result");
  assert.equal(result.winner.id, room.meals[0].id);
});
