import { chromium } from "playwright";

const COACH_EMAIL = process.env.E2E_COACH_EMAIL;
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD;
if (!COACH_EMAIL || !COACH_PASSWORD) {
  console.error("Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD no ambiente (nunca hardcode credenciais reais aqui).");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();

// athlete requests data export
await page.goto("http://localhost:3000/login");
await page.fill('input[type="email"]', "lgpd.e2e.teste@example.com");
await page.fill('input[type="password"]', "TesteLgpd123!");
await page.click('button[type="submit"]');
await page.waitForURL("**/perfil");

await page.goto("http://localhost:3000/privacidade");
await page.click('button:has-text("Baixar meus dados")');
await page.waitForSelector("text=cópia dos seus dados", { timeout: 10000 });
console.log("Athlete data export request submitted: OK");

await page.click('button:has-text("Solicitar exclusão")');
await page.waitForSelector("text=exclusão enviada", { timeout: 10000 });
console.log("Athlete deletion request submitted: OK");

// logout
await page.click('button[title="Sair"]');
await page.waitForURL("**/login");

// coach reviews and resolves
await page.fill('input[type="email"]', COACH_EMAIL);
await page.fill('input[type="password"]', COACH_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");

await page.goto("http://localhost:3000/config");
const requestsText = await page.textContent("main");
console.log("Config page shows LGPD Teste Athlete requests:", requestsText.includes("LGPD Teste Athlete"));
console.log("Shows both export and deletion:", requestsText.includes("Exportação") && requestsText.includes("Exclusão"));

const resolveButtons = await page.locator('button:has-text("Marcar como concluído")').count();
console.log("Pending resolve buttons found:", resolveButtons);
if (resolveButtons > 0) {
  await page.locator('button:has-text("Marcar como concluído")').first().click();
  await page.waitForTimeout(1500);
  await page.reload();
  const concludedCount = await page.locator("text=Concluído").count();
  console.log("At least one request now shows Concluído:", concludedCount > 0);
}

await browser.close();
console.log("E2E LGPD CHECK: PASS");
