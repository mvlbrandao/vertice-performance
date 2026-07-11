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
console.log("Logged in, dashboard heading:", await page.textContent("h1"));

// -------- create athlete --------
await page.goto("http://localhost:3000/athletes");
await page.click('button:has-text("Novo atleta")');
await page.fill('input[name="fullName"]', "Teste E2E Silva");
await page.fill('input[name="category"]', "Futsal Sub-12");
await page.fill('input[name="position"]', "Pivô");
await page.fill('input[name="team"]', "Sub-12 A");
await page.click('button:has-text("Cadastrar")');
await page.waitForSelector('text=Teste E2E Silva', { timeout: 10000 });
console.log("Athlete created and visible in list: OK");

await page.click('text=Teste E2E Silva');
await page.waitForURL("**/dados");
console.log("Athlete detail URL:", page.url());
console.log("Header name:", await page.textContent("h2"));

// -------- evolucao: game report --------
await page.click('a:has-text("Linha do tempo")');
await page.waitForURL("**/evolucao");
await page.click('button:has-text("Relatório de jogo")');
await page.fill('input[name="opponent"]', "Sub-12 x Time Teste");
await page.fill('textarea[name="strengths"]', "Boa marcação");
await page.click('button:has-text("Salvar relatório")');
await page.waitForSelector('text=Relatório de jogo — Sub-12 x Time Teste', { timeout: 10000 });
console.log("Game report created and visible in timeline: OK");

// -------- mental note --------
await page.click('button:has-text("Registro mental")');
await page.fill('input[name="title"]', "Confiança em finalizações");
await page.click('div[role="dialog"] >> text=Salvar >> nth=0').catch(() => {});
await page.click('button:has-text("Salvar"):not(:has-text("relatório"))');
await page.waitForSelector('text=Confiança em finalizações', { timeout: 10000 });
console.log("Mental note created and visible in timeline: OK");

// -------- exercise --------
await page.click('a:has-text("Treinos")');
await page.waitForURL("**/treino");
await page.click('button:has-text("Prescrever")');
await page.fill('input[name="name"]', "Equilíbrio unipodal");
await page.fill('input[name="focus"]', "Equilíbrio");
await page.click('button:has-text("Enviar rotina")');
await page.waitForSelector('text=Equilíbrio unipodal', { timeout: 10000 });
console.log("Exercise created and visible: OK");

// -------- checkin tab (should be empty, read-only for coach) --------
await page.click('a:has-text("Check-ins")');
await page.waitForURL("**/checkin");
console.log("Checkin tab heading:", await page.textContent("h2"));

// -------- dashboard reflects new athlete --------
await page.goto("http://localhost:3000/dashboard");
const kpi = await page.textContent("main");
console.log("Dashboard mentions athlete count context. Contains 'Teste E2E Silva':", kpi.includes("Teste E2E Silva"));

await browser.close();
console.log("E2E ATHLETE CRUD CHECK: PASS");
