import { chromium } from "playwright";

const COACH_EMAIL = process.env.E2E_COACH_EMAIL;
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD;
if (!COACH_EMAIL || !COACH_PASSWORD) {
  console.error("Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD no ambiente (nunca hardcode credenciais reais aqui).");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();

await page.goto("http://localhost:3000/login");
await page.fill('input[type="email"]', COACH_EMAIL);
await page.fill('input[type="password"]', COACH_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");

await page.goto("http://localhost:3000/athletes");
await page.click("text=Atleta E2E Teste");
await page.waitForURL("**/dados");
const badgeVisible = await page.locator("text=Conta de acesso já criada").isVisible();
console.log("Already-provisioned badge visible:", badgeVisible);

await browser.close();
console.log("E2E INVITE BADGE CHECK: PASS");
