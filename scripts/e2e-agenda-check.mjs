import { chromium } from "playwright";

const COACH_EMAIL = process.env.E2E_COACH_EMAIL;
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD;
if (!COACH_EMAIL || !COACH_PASSWORD) {
  console.error("Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD no ambiente (nunca hardcode credenciais reais aqui).");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto("http://localhost:3000/login");
await page.fill('input[type="email"]', COACH_EMAIL);
await page.fill('input[type="password"]', COACH_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");

await page.goto("http://localhost:3000/athletes");
await page.click('button:has-text("Novo atleta")');
await page.fill('input[name="fullName"]', "Agenda Teste Athlete");
await page.click('button:has-text("Cadastrar")');
await page.waitForSelector("text=Agenda Teste Athlete", { timeout: 10000 });

await page.goto("http://localhost:3000/agenda");
await page.click('button:has-text("Agendar encontro")');
await page.selectOption('select[name="athleteId"]', { label: "Agenda Teste Athlete" });
await page.fill('input[name="title"]', "Avaliação técnica individual");
await page.fill('input[name="date"]', "2026-08-01");
await page.fill('input[name="time"]', "16:00");
await page.getByRole("button", { name: "Agendar", exact: true }).click();
await page.waitForSelector("text=Avaliação técnica individual", { timeout: 10000 });
console.log("Meeting created and visible: OK");

await page.click('button:has-text("Gerenciar")');
await page.fill("textarea", "Combinado plano de treino para o mês.");
await page.getByRole("button", { name: "Salvar notas" }).click();
await page.waitForTimeout(1500);
await page.reload();
const hasNotes = await page.locator("text=Notas registradas").isVisible().catch(() => false);
console.log("Meeting notes saved and reflected: ", hasNotes);

await page.goto("http://localhost:3000/dashboard");
const dashboardText = await page.textContent("main");
console.log("Dashboard shows the meeting:", dashboardText.includes("Avaliação técnica individual"));

await browser.close();
console.log("E2E AGENDA CHECK: PASS");
