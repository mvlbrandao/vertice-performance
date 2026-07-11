import { chromium } from "playwright";

const COACH_EMAIL = process.env.E2E_COACH_EMAIL;
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD;
if (!COACH_EMAIL || !COACH_PASSWORD) {
  console.error("Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD no ambiente (nunca hardcode credenciais reais aqui).");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();

page.on("console", (msg) => console.log("[browser]", msg.type(), msg.text()));
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto("http://localhost:3000/login");
console.log("Loaded:", page.url());

await page.fill('input[type="email"]', COACH_EMAIL);
await page.fill('input[type="password"]', COACH_PASSWORD);
await page.click('button[type="submit"]');

await page.waitForURL("**/dashboard", { timeout: 10000 });
console.log("After login, URL:", page.url());

const heading = await page.textContent("h1");
console.log("Dashboard heading:", heading);

const sidebarName = await page.textContent("aside b");
console.log("Sidebar user:", sidebarName);

await browser.close();
console.log("E2E LOGIN CHECK: PASS");
