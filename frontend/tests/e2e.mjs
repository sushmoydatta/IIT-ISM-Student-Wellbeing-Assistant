// End-to-end check of every user-facing feature.
// Run from the repo root:  python3 -m http.server 5511 -d frontend &  node frontend/tests/e2e.mjs
// Uses the Playwright library directly (no test runner needed).
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { chromium } = require("playwright");

const BASE = process.env.BASE_URL || "http://localhost:5511/";
const results = [];
let failed = 0;

async function check(name, fn) {
  try { await fn(); results.push(`  ✓ ${name}`); }
  catch (e) { failed++; results.push(`  ✗ ${name}\n      ${String(e.message).split("\n")[0]}`); }
}
function assert(cond, msg) { if (!cond) throw new Error(msg); }

const browser = await chromium.launch({ args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader"] });

async function fresh(opts = {}) {
  const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, ...opts });
  const page = await ctx.newPage();
  page.errors = [];
  page.on("pageerror", e => page.errors.push(e.message));
  page.on("console", m => { if (m.type() === "error") page.errors.push(m.text()); });
  return page;
}
const botCount = p => p.locator(".msg.bot:not(.typing)").count();
async function waitBot(p, n) { await p.waitForFunction(k => document.querySelectorAll(".msg.bot:not(.typing)").length >= k, n, { timeout: 8000 }); }
async function say(p, text) { const n = await botCount(p); await p.fill("#input", text); await p.keyboard.press("Enter"); await waitBot(p, n + 1); }

// ---------------------------------------------------------------- welcome + vibes
let page = await fresh();
await page.goto(BASE);
await check("loads with no console errors", async () => { await page.waitForTimeout(800); assert(page.errors.length === 0, page.errors.join(" | ")); });
await check("welcome shows 6 moods and 3 vibe swatches", async () => {
  assert(await page.locator(".mood").count() === 6, "moods");
  assert(await page.locator(".vibe-row .swatch").count() === 3, "swatches");
});
await check("breath cue updates on the scene clock", async () => {
  const a = await page.textContent("#orb-cue");
  await page.waitForTimeout(4300);
  const b = await page.textContent("#orb-cue");
  assert(a !== b, `cue stayed "${a}"`);
});
await check("vibe swatch switches theme and persists after reload", async () => {
  await page.click('.vibe-row .swatch[data-vibe="dusk"]');
  assert(await page.getAttribute("html", "data-vibe") === "dusk", "not applied");
  await page.reload(); await page.waitForTimeout(300);
  assert(await page.getAttribute("html", "data-vibe") === "dusk", "not persisted");
});
await check("vibe dialog lists 3 vibes and switches", async () => {
  await page.click('.tools [data-open="vibe"]');
  assert(await page.locator(".vibe-card").count() === 3, "cards");
  await page.click('.vibe-card[data-vibe="neural"]');
  assert(await page.getAttribute("html", "data-vibe") === "neural", "not applied");
  await page.keyboard.press("Escape");
  assert(!(await page.locator("#dlg-vibe").evaluate(d => d.open)), "dialog did not close on Escape");
});

// ---------------------------------------------------------------- chat
await check("mood starts chat with a mood-specific opener", async () => {
  await page.click('[data-mood="anxious"]');
  await waitBot(page, 1);
  assert(await page.isHidden("#welcome"), "welcome still visible");
  assert((await page.textContent(".msg.bot .bubble")).includes("Anxiety"), "opener not anxious-specific");
});
await check("send button disabled when empty; Shift+Enter adds a newline", async () => {
  assert(await page.isDisabled("#send"), "send enabled on empty");
  await page.fill("#input", "line one"); await page.keyboard.press("Shift+Enter"); await page.keyboard.type("line two");
  assert((await page.inputValue("#input")).includes("\n"), "no newline");
  await page.fill("#input", "");
});
await check("topic reply: exam stress", async () => {
  await say(page, "I have endsems next week and haven't started");
  assert((await page.locator(".msg.bot").last().textContent()).includes("shrink the task") || (await page.locator(".msg.bot").last().textContent()).includes("25-minute"), "wrong reply");
});
await check("follow-up stays on topic", async () => {
  await say(page, "idk");
  const t = await page.locator(".msg.bot").last().textContent();
  assert(t.includes("25 minutes") || t.includes("smaller"), `got: ${t.slice(0, 80)}`);
});
await check("draft is kept if Enter is pressed while Sukoon is replying", async () => {
  await page.fill("#input", "I feel lonely"); await page.keyboard.press("Enter");
  await page.fill("#input", "second message"); await page.keyboard.press("Enter");
  assert(await page.inputValue("#input") === "second message", "draft lost");
  await waitBot(page, await botCount(page));
  await page.fill("#input", "");
});
await check("action chip opens the matching tool", async () => {
  await page.locator(".msg.bot .chip", { hasText: "Breathe" }).first().click();
  assert(await page.locator("#dlg-breathe").evaluate(d => d.open), "breathe dialog not open");
  await page.keyboard.press("Escape");
});
await check("crisis message shows safety card with tap-to-call numbers", async () => {
  await say(page, "I want to end my life");
  const card = page.locator(".crisis-card").last();
  assert(await card.isVisible(), "no card");
  const hrefs = await card.locator("a").evaluateAll(as => as.map(a => a.getAttribute("href")));
  assert(hrefs.includes("tel:14416") && hrefs.includes("tel:112"), hrefs.join(","));
});
await check("indirect phrasing is caught (passive ideation)", async () => {
  const n = await page.locator(".crisis-card").count();
  await say(page, "honestly nobody would notice if I was gone");
  assert(await page.locator(".crisis-card").count() === n + 1, "not flagged");
});
await check("'yes' to the safety question escalates to helplines", async () => {
  const n = await page.locator(".crisis-card").count();
  await say(page, "I feel hopeless");
  assert((await page.locator(".msg.bot").last().textContent()).includes("thoughts of hurting yourself"), "no safety question");
  await say(page, "yes");
  assert(await page.locator(".crisis-card").count() === n + 1, "did not escalate");
});
await check("user text is rendered as text (no HTML injection)", async () => {
  await say(page, '<img src=x onerror="window.__xss=1">');
  assert(await page.locator(".msg.user img").count() === 0, "img injected");
  assert(!(await page.evaluate(() => window.__xss)), "script ran");
});

// ---------------------------------------------------------------- tools
await check("breathing: choose 1 min, begin shows phases, stop resets", async () => {
  await page.click('.tools [data-open="breathe"]');
  await page.click('.seg button[data-min="1"]');
  assert(await page.getAttribute('.seg button[data-min="1"]', "aria-checked") === "true", "duration not selected");
  await page.click("#breath-toggle");
  assert((await page.textContent("#breath-phase")) === "breathe in", "no inhale");
  await page.waitForTimeout(4300);
  assert((await page.textContent("#breath-phase")) === "breathe out", "no exhale");
  await page.click("#breath-toggle");
  assert((await page.textContent("#breath-phase")) === "ready", "did not reset");
  await page.keyboard.press("Escape");
});
await check("grounding: steps 5→1, back works, finish posts a check-in", async () => {
  const n = await botCount(page);
  await page.click('.tools [data-open="ground"]');
  assert((await page.textContent("#ground-card .big")) === "5", "does not start at 5");
  await page.click("#ground-next"); await page.click("#ground-back");
  assert((await page.textContent("#ground-card .big")) === "5", "back failed");
  for (let i = 0; i < 5; i++) await page.click("#ground-next");
  assert((await page.textContent("#ground-card")).includes("You’re here"), "no completion");
  await page.click("#ground-next");
  await waitBot(page, n + 1);
});
await check("reframe: save, persists after reload, remove", async () => {
  await page.click('.tools [data-open="reframe"]');
  await page.fill('#reframe-form [name="thought"]', "I will fail");
  await page.fill('#reframe-form [name="friend"]', "You prepared");
  await page.fill('#reframe-form [name="reframe"]', "I can do one topic today");
  await page.click('#reframe-form button[type="submit"]');
  assert(await page.locator(".reframe-item").count() >= 1, "not saved");
  await page.reload();
  await page.click('.tools [data-open="reframe"]');
  assert(await page.locator(".reframe-item").count() >= 1, "not persisted");
  const n = await page.locator(".reframe-item").count();
  await page.locator(".reframe-item button").first().click();
  assert(await page.locator(".reframe-item").count() === n - 1, "not removed");
  await page.keyboard.press("Escape");
});
await check("help: 5 helplines incl. Tele-MANAS and 112", async () => {
  await page.click('.tools [data-open="help"]');
  const hrefs = await page.locator(".helpline").evaluateAll(as => as.map(a => a.getAttribute("href")));
  assert(hrefs.length === 5 && hrefs.includes("tel:14416") && hrefs.includes("tel:112"), hrefs.join(","));
  await page.keyboard.press("Escape");
});
await check("about explains demo-mode privacy", async () => {
  await page.click('.tools [data-open="about"]');
  assert((await page.textContent("#mode-note")).includes("demo mode"), "no mode note");
  await page.keyboard.press("Escape");
});
await check("no console errors during the whole session", async () => assert(page.errors.length === 0, page.errors.join(" | ")));
await page.context().close();

// ---------------------------------------------------------------- live API mode
page = await fresh();
await page.route("**/fake-api/chat", route => route.fulfill({ status: 200, contentType: "application/json",
  body: JSON.stringify({ response: "Live answer from the API.", is_crisis: false, sources: ["exam_stress.md"] }) }));
await page.goto(BASE + "?api=http://localhost:5511/fake-api/chat");
await check("live mode: status pill shows live", async () => assert((await page.textContent("#status-text")).includes("live"), "not live"));
await check("live mode: answer and sources come from the API", async () => {
  await page.click("#skip-checkin"); await waitBot(page, 1);
  await say(page, "how do I prepare for exams");
  const last = page.locator(".msg.bot").last();
  assert((await last.textContent()).includes("Live answer"), "not from API");
  assert((await last.textContent()).includes("exam_stress.md"), "no sources");
});
await check("live mode: falls back on-device if the API fails", async () => {
  await page.unroute("**/fake-api/chat");
  await page.route("**/fake-api/chat", route => route.abort());
  await say(page, "I can't sleep");
  assert((await page.locator(".msg.bot").last().textContent()).includes("unreachable"), "no fallback note");
});
await check("live mode: crisis never waits for the network", async () => {
  let called = false;
  await page.unroute("**/fake-api/chat");
  await page.route("**/fake-api/chat", route => { called = true; route.abort(); });
  await say(page, "I want to kill myself");
  assert(!called, "API was called for a crisis message");
});
await page.context().close();

// ---------------------------------------------------------------- resilience
page = await fresh({ reducedMotion: "reduce" });
await page.goto(BASE);
await check("reduced motion: static breathing hint", async () => assert((await page.textContent("#orb-cue")).includes("in for 4"), "cue animates"));
await page.context().close();

page = await fresh();
await page.addInitScript(() => { HTMLCanvasElement.prototype.getContext = () => null; });
await page.goto(BASE);
await check("no WebGL: CSS fallback orb shows and chat still works", async () => {
  assert(!(await page.evaluate(() => document.documentElement.classList.contains("gl"))), "gl class set");
  assert(await page.locator(".orb").isVisible(), "fallback orb hidden");
  await page.click("#skip-checkin"); await waitBot(page, 1);
  await say(page, "hello");
  assert(page.errors.length === 0, page.errors.join(" | "));
});
await page.context().close();

page = await fresh();
await page.addInitScript(() => { Object.defineProperty(window, "localStorage", { get() { throw new Error("blocked"); } }); });
await page.goto(BASE);
await check("blocked storage (private mode): app still works", async () => {
  await page.click('[data-mood="low"]'); await waitBot(page, 1);
  await say(page, "I feel lonely");
  assert(page.errors.length === 0, page.errors.join(" | "));
});
await page.context().close();

page = await fresh({ viewport: { width: 360, height: 740 }, hasTouch: true, isMobile: true });
await page.goto(BASE);
await check("small phone: no sideways scroll on welcome or chat", async () => {
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "welcome overflows");
  await page.click('[data-mood="overwhelmed"]'); await waitBot(page, 1);
  await say(page, "placements are stressing me out");
  assert(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth), "chat overflows");
  assert(await page.locator("#composer").isVisible(), "composer hidden");
});
await page.context().close();

await browser.close();
console.log(results.join("\n"));
console.log(`\n${results.length - failed}/${results.length} passed`);
process.exit(failed ? 1 : 0);
