import { chromium } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { testDatabase } from "./database.js";
import { tmpdir } from "node:os";
import { join } from "node:path";
const database = await testDatabase();
const port = 3107,
  base = `http://127.0.0.1:${port}`;
const child = spawn(process.execPath, ["server.js"], {
  env: {
    ...process.env,
    NODE_ENV: "development",
    PORT: String(port),
    DATABASE_URL: database.url,
    EATWHAT_TEST_SCHEMA: database.schema,
  },
  stdio: ["ignore", "pipe", "pipe"],
});
let serverOutput = "";
child.stdout.on("data", (data) => {
  serverOutput += data;
});
child.stderr.on("data", (data) => {
  serverOutput += data;
});
let browser;
const errors = [];
async function audit(page, screen) {
  const result = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21aa"])
    .analyze();
  assert.deepEqual(
    result.violations.map((v) => ({
      id: v.id,
      nodes: v.nodes.map((n) => n.target),
    })),
    [],
    `${screen} accessibility`,
  );
  const overflow = await page.evaluate(() =>
    [...document.querySelectorAll("body *")]
      .filter((el) => el.getBoundingClientRect().right > innerWidth + 1)
      .map((el) => ({
        tag: el.tagName,
        cls: el.className,
        right: el.getBoundingClientRect().right,
      })),
  );
  assert.equal(
    await page.evaluate(
      () => document.documentElement.scrollWidth > innerWidth,
    ),
    false,
    `${screen} horizontal overflow: ${JSON.stringify(overflow)}`,
  );
  console.log(`PASS: ${screen} — accessibility and layout`);
}
try {
  let ready = false;
  for (let i = 0; i < 200; i++) {
    try {
      ready = (await fetch(base)).ok;
      if (ready) break;
    } catch {}
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
  assert.ok(ready, serverOutput);
  browser = await chromium.launch({
    headless: true,
    executablePath:
      process.env.CHROMIUM_PATH ||
      (existsSync("/usr/bin/chromium") ? "/usr/bin/chromium" : undefined),
  });
  const hostContext = await browser.newContext({
    viewport: { width: 1440, height: 1100 },
  });
  const guestContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
    reducedMotion: "reduce",
  });
  const host = await hostContext.newPage(),
    guest = await guestContext.newPage();
  for (const p of [host, guest]) {
    p.on("pageerror", (error) => errors.push(error.message));
  }
  await host.goto(base);
  await audit(host, "desktop create");
  await host.screenshot({
    path: join(tmpdir(), "eatwhat-desktop.png"),
    fullPage: true,
  });
  await host.keyboard.press("Tab");
  assert.ok(
    await host.evaluate(
      () => getComputedStyle(document.activeElement).outlineStyle !== "none",
    ),
    "Visible keyboard focus",
  );
  for (const width of [320, 390, 768]) {
    await guest.setViewportSize({ width, height: 844 });
    await guest.goto(base);
    await audit(guest, `create at ${width}px`);
  }
  await guest.setViewportSize({ width: 390, height: 844 });
  await guest.screenshot({
    path: join(tmpdir(), "eatwhat-mobile.png"),
    fullPage: true,
  });
  await host.getByLabel("YOUR NAME").fill("Alex");
  await host.getByLabel("PEOPLE", { exact: true }).fill("2");
  await host.getByLabel("BUDGET (LKR)", { exact: true }).fill("10000");
  await host.getByLabel("DISTANCE (KM)", { exact: true }).fill("3");
  await host.getByRole("button", { name: "Create room", exact: true }).click();
  await host
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  const code = await host.locator(".room-code").innerText();
  assert.match(code, /^[A-F0-9]{6}$/);
  // Home must stay home even with a saved room, including after reload.
  await host.getByRole("link", { name: "EATWHAT home" }).click();
  await host
    .getByRole("heading", { name: "Your table starts here." })
    .waitFor();
  assert.equal(new URL(host.url()).search, "");
  await host.reload();
  await host
    .getByRole("heading", { name: "Your table starts here." })
    .waitFor();
  await host.getByRole("button", { name: `Back to room ${code}` }).click();
  await host
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  assert.equal(new URL(host.url()).search, `?room=${code}`);
  await host.getByRole("button", { name: "Back to create room" }).click();
  await host.getByRole("button", { name: `Back to room ${code}` }).click();
  await audit(host, "lobby");
  await host.screenshot({
    path: join(tmpdir(), "eatwhat-lobby.png"),
    fullPage: true,
  });
  await guest.goto(`${base}/?room=${code}`);
  await guest.getByLabel("YOUR NAME").fill("Sam");
  await guest.getByRole("button", { name: "Join room", exact: true }).click();
  await guest
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  await guest.getByRole("button", { name: "I’m ready to eat" }).click();
  await host.getByRole("button", { name: "I’m ready to eat" }).click();
  await host.getByRole("button", { name: "Start voting" }).click();
  await host.getByRole("heading", { name: "Would you eat this?" }).waitFor();
  await guest.getByRole("heading", { name: "Would you eat this?" }).waitFor();
  await audit(host, "voting");
  await audit(guest, "mobile voting");
  await host.screenshot({
    path: join(tmpdir(), "eatwhat-voting.png"),
    fullPage: true,
  });
  // Independent contexts prove identities and private vote progress are separate.
  for (let i = 0; i < 6; i++) {
    const old = await host.locator(".image-count").innerText();
    await host.getByRole("button", { name: "Yes, I’d eat this" }).click();
    if (i < 5)
      await host.waitForFunction(
        (old) => document.querySelector(".image-count")?.textContent !== old,
        old,
      );
  }
  await host
    .getByRole("heading", { name: "Good taste takes a moment." })
    .waitFor();
  assert.equal(await guest.locator(".image-count").innerText(), "1 / 6");
  await audit(host, "waiting for private votes");
  await host.getByRole("button", { name: "Back to create room" }).click();
  await host.waitForTimeout(1700);
  await host
    .getByRole("heading", { name: "Your table starts here." })
    .waitFor();
  assert.equal(new URL(host.url()).search, "");
  await host.getByRole("button", { name: `Back to room ${code}` }).click();
  await host
    .getByRole("heading", { name: "Good taste takes a moment." })
    .waitFor();
  for (let i = 0; i < 6; i++) {
    const old = await guest.locator(".image-count").innerText();
    await guest.getByRole("button", { name: "Yes, I’d eat this" }).click();
    if (i < 5)
      await guest.waitForFunction(
        (old) => document.querySelector(".image-count")?.textContent !== old,
        old,
      );
  }
  await host
    .getByRole("heading", { name: "It’s a match. Let’s eat." })
    .waitFor();
  await guest
    .getByRole("heading", { name: "It’s a match. Let’s eat." })
    .waitFor();
  await audit(host, "match");
  await audit(guest, "mobile match");
  assert.equal(
    await guest
      .locator(".match-panel")
      .evaluate((el) => getComputedStyle(el).animationName),
    "none",
  );
  assert.match(
    await host
      .getByRole("link", { name: /Get directions/ })
      .getAttribute("href"),
    /^https:\/\/www.google.com\/maps\/search/,
  );
  await host.screenshot({
    path: join(tmpdir(), "eatwhat-match.png"),
    fullPage: true,
  });
  await host.reload();
  await host
    .getByRole("heading", { name: "It’s a match. Let’s eat." })
    .waitFor();
  await host.getByRole("button", { name: /Another round/ }).click();
  await guest
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  await guest.getByRole("button", { name: "I’m ready to eat" }).click();
  await host.getByRole("button", { name: "I’m ready to eat" }).click();
  await host.getByRole("button", { name: "Start voting" }).click();
  await guest.getByRole("heading", { name: "Would you eat this?" }).waitFor();
  // Exercise swipe on a real pointer as well as the accessible controls.
  const image = await host.locator("#swipe-card").boundingBox();
  await host.mouse.move(image.x + 160, image.y + 100);
  await host.mouse.down();
  await host.mouse.move(image.x + 40, image.y + 100);
  await host.mouse.up();
  await host.waitForFunction(
    () => document.querySelector(".image-count")?.textContent === "2 / 6",
  );
  for (const [page, count] of [
    [host, 5],
    [guest, 6],
  ]) {
    for (let i = 0; i < count; i++) {
      const old = await page.locator(".image-count").innerText();
      await page.getByRole("button", { name: "Pass", exact: true }).click();
      if (i < count - 1)
        await page.waitForFunction(
          (old) => document.querySelector(".image-count")?.textContent !== old,
          old,
        );
    }
  }
  await host.getByRole("heading", { name: "No unanimous match" }).waitFor();
  await audit(host, "no unanimous match");
  const otherContext = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const other = await otherContext.newPage();
  await other.goto(`${base}/?room=ZZZZZZ`);
  await other.getByLabel("YOUR NAME").fill("Taylor");
  await other.getByRole("button", { name: "Join room", exact: true }).click();
  await other.getByRole("alert").waitFor();
  await audit(other, "invalid room code");
  await other
    .getByRole("button", { name: "Create a room", exact: true })
    .click();
  await other.getByLabel("YOUR NAME").fill("Taylor");
  await other.getByLabel("PEOPLE", { exact: true }).fill("2");
  await other.getByLabel("BUDGET (LKR)", { exact: true }).fill("3000");
  await other.getByLabel("DISTANCE (KM)", { exact: true }).fill("1");
  await other.getByLabel("Vegetarian options only").check();
  await other.getByRole("button", { name: "Create room", exact: true }).click();
  await other
    .getByRole("heading", { name: "A table worth waiting for." })
    .waitFor();
  const emptyCode = await other.locator(".room-code").innerText();
  const emptyGuestContext = await browser.newContext();
  const joined = await emptyGuestContext.request.post(
    `${base}/api/rooms/${emptyCode}/join`,
    { data: { name: "Morgan" } },
  );
  assert.ok(joined.ok());
  assert.ok(
    (
      await emptyGuestContext.request.post(
        `${base}/api/rooms/${emptyCode}/ready`,
        { data: { ready: true } },
      )
    ).ok(),
  );
  await other.getByRole("button", { name: "I’m ready to eat" }).click();
  await other.getByRole("button", { name: "Start voting" }).click();
  await other
    .getByRole("heading", { name: "No meals fit these filters" })
    .waitFor();
  await audit(other, "no meals fit filters");
  assert.deepEqual(errors, []);
  console.log(
    "PASS: two-person create/join, readiness, private voting, swipe, match, refresh, restart, no match, reduced motion, and invalid code",
  );
} finally {
  await browser?.close();
  if (child.exitCode === null && child.signalCode === null) {
    const exited = new Promise((resolve) => child.once("exit", resolve));
    child.kill();
    await exited;
  }
  await database.cleanup();
}
