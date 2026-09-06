// Records the LinkedIn walkthrough against a production server on :3100.
// Usage: npm run build && npx next start -p 3100 & node scripts/record-demo.mjs <outDir>
import { chromium } from "playwright";
import fs from "node:fs";
const SP = process.argv[2]; const BASE = "http://localhost:3100";
for (let i = 0; i < 40; i++) { try { const r = await fetch(BASE); if (r.ok) break; } catch {} await new Promise(r => setTimeout(r, 2000)); }
const browser = await chromium.launch({ args: ["--use-gl=angle", "--enable-unsafe-swiftshader", "--ignore-gpu-blocklist"] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, colorScheme: "dark", recordVideo: { dir: SP + "/video/raw", size: { width: 1440, height: 900 } } });
const page = await ctx.newPage();
const t0 = Date.now(); const marks = []; const mark = (label) => marks.push({ t: (Date.now() - t0) / 1000, label });
const wait = (ms) => page.waitForTimeout(ms);
const glide = async (x1, y1, x2, y2, steps = 24, ms = 700) => { for (let i = 1; i <= steps; i++) { await page.mouse.move(x1 + (x2 - x1) * i / steps, y1 + (y2 - y1) * i / steps); await wait(ms / steps); } };
const scrollTo = async (y, steps = 30, ms = 900) => { const y0 = await page.evaluate(() => window.scrollY); for (let i = 1; i <= steps; i++) { await page.evaluate((v) => window.scrollTo(0, v), y0 + (y - y0) * i / steps); await wait(ms / steps); } };

await page.goto(BASE + "/", { waitUntil: "networkidle" }); await page.mouse.move(700, 450); mark("Every 3D model on the machine, indexed from the files themselves"); await wait(3200);
await scrollTo(560, 30, 1000); mark("Browse the library — hover a card to see its wireframe"); await wait(600);
const cards = page.locator("main .grid > *");
for (const i of [0, 1, 2]) { const b = await cards.nth(i).boundingBox(); await glide(700, 450, b.x + b.width / 2, b.y + b.height / 2, 14, 350); await wait(1100); }
mark("Filter by triangle budget — every count is read from the file");
await page.getByRole("button", { name: /Triangle budget/ }).click(); await wait(900);
await page.locator("[role=listbox]").waitFor(); await page.locator("[role=listbox] [role=option]", { hasText: /^Light/ }).first().click(); await wait(500); await page.keyboard.press("Escape"); await wait(1500);
await scrollTo(1100, 24, 800); await wait(1200);
await page.getByRole("button", { name: "Reset" }).click(); await wait(600);
mark("Search across projects"); await scrollTo(560, 20, 500);
const search = page.getByRole("searchbox"); await search.click(); await search.pressSequentially("zombie", { delay: 140 }); await wait(1800);
await search.fill(""); await wait(500);
mark("Several exports of one asset share a card — pick the variant you need");
const vb = page.getByRole("button", { name: /variants/ }).first(); await vb.scrollIntoViewIfNeeded(); await wait(400);
const vbb = await vb.boundingBox(); await glide(700, 450, vbb.x + vbb.width / 2, vbb.y + vbb.height / 2, 14, 400); await vb.click(); await wait(2200);
await page.locator("dialog[open] a").first().click(); await page.waitForLoadState("networkidle"); await wait(4200);
mark("Inspect it live — orbit, then flip through render modes");
const cv = await page.locator("canvas").boundingBox(); const cx = cv.x + cv.width / 2, cy = cv.y + cv.height / 2;
await page.mouse.move(cx, cy); await page.mouse.down(); await glide(cx, cy, cx + 260, cy - 60, 40, 1600); await page.mouse.up(); await wait(600);
for (const m of ["Wireframe", "Normals", "UV checker", "Rendered"]) { await page.getByRole("button", { name: m, exact: true }).click(); await wait(1500); }
await page.getByRole("button", { name: "Turntable" }).click(); await wait(2800); await page.getByRole("button", { name: "Turntable" }).click();
mark("Specs on the side: geometry, bounding box, materials, rig — and a download button");
await scrollTo(520, 30, 1200); await wait(2400);
mark("Rigged models play their clips");
await page.goto(BASE + "/model/89abfba370c61da2", { waitUntil: "networkidle" }); await wait(5000);
mark("The overview: where the triangles went");
await page.goto(BASE + "/overview", { waitUntil: "networkidle" }); await wait(2200); await scrollTo(700, 30, 1500); await wait(1800);
mark("Light or dark — free to download, no attribution required");
await page.goto(BASE + "/", { waitUntil: "networkidle" }); await wait(800); await page.getByTitle(/theme/i).click(); await wait(1600); await scrollTo(560, 24, 900); await wait(2200);
mark("END");
await ctx.close(); await browser.close();
const file = fs.readdirSync(SP + "/video/raw").filter(f => f.endsWith(".webm")).map(f => SP + "/video/raw/" + f).sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0];
fs.writeFileSync(SP + "/video/marks.json", JSON.stringify({ file, marks }, null, 1));
console.log("recorded", file, "duration ~", marks.at(-1).t.toFixed(1) + "s");
