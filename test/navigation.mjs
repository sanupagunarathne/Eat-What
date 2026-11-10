import { chromium } from "@playwright/test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { meals } from "../meals.js";

// Exercise the real frontend with deterministic API responses, without a database.
const browser = await chromium.launch({ headless: true });
try {
  const page = await browser.newPage();
  let phase = "lobby";
  let releaseResponse;
  let delayNext = false;
  let responseStarted;
  const room = () => ({
    code: "ABC123",
    phase,
    expected: 2,
    isHost: true,
    ready: false,
    filters: { budget: 10000, distance: 3, cuisine: "Any" },
    members: [
      { name: "Alex", me: true, host: true, ready: false, done: false },
    ],
    meals: meals.slice(0, 1),
    votedIds: phase === "voting" ? [meals[0].id] : [],
    winner: null,
  });
  await page.route("http://eatwhat.test/**", async (route) => {
    const path = new URL(route.request().url()).pathname;
    if (path.startsWith("/api/")) {
      if (delayNext) {
        delayNext = false;
        responseStarted();
        await new Promise((resolve) => {
          releaseResponse = resolve;
        });
      }
      await route.fulfill({ json: room() });
      return;
    }
    const name = path === "/" ? "index.html" : path.slice(1);
    try {
      const body = await readFile(
        new URL(`../public/${name}`, import.meta.url),
      );
      await route.fulfill({
        body,
        contentType: name.endsWith(".js")
          ? "text/javascript"
          : name.endsWith(".css")
            ? "text/css"
            : name.endsWith(".html")
              ? "text/html"
              : "image/jpeg",
      });
    } catch {
      await route.fulfill({ status: 404, body: "Not found" });
    }
  });
  await page.addInitScript(() =>
    localStorage.setItem("eatwhat-room", "ABC123"),
  );
  await page.goto("http://eatwhat.test/?room=ABC123");
  await page
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  await page.getByRole("link", { name: "EATWHAT home" }).click();
  assert.equal(new URL(page.url()).search, "");
  await page.reload();
  await page
    .getByRole("heading", { name: "Your table starts here." })
    .waitFor();
  await page.getByRole("button", { name: "Back to room ABC123" }).click();
  await page
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  await page.goBack();
  await page
    .getByRole("heading", { name: "Your table starts here." })
    .waitFor();
  await page.goForward();
  await page
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  for (phase of ["lobby", "voting", "result", "empty"]) {
    await page.goto("http://eatwhat.test/?room=ABC123");
    await page.getByRole("button", { name: "Back to create room" }).waitFor();
    const pending = new Promise((resolve) => {
      responseStarted = resolve;
    });
    delayNext = true;
    await pending;
    await page.getByRole("button", { name: "Back to create room" }).click();
    releaseResponse();
    await page
      .getByRole("heading", { name: "Your table starts here." })
      .waitFor();
    await page.waitForTimeout(100);
    assert.equal(new URL(page.url()).search, "");
    assert.equal(await page.locator("#room-form").count(), 1);
  }
  console.log(
    "PASS: logo, home reload, resume, browser history, all room phases, and late polling responses",
  );
} finally {
  await browser.close();
}
