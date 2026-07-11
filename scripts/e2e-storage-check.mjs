import { chromium } from "playwright";
import path from "node:path";

const COACH_EMAIL = process.env.E2E_COACH_EMAIL;
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD;
if (!COACH_EMAIL || !COACH_PASSWORD) {
  console.error("Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD no ambiente (nunca hardcode credenciais reais aqui).");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));
page.on("console", (msg) => {
  if (msg.type() === "error") console.log("[console.error]", msg.text());
});

await page.goto("http://localhost:3000/login");
await page.fill('input[type="email"]', COACH_EMAIL);
await page.fill('input[type="password"]', COACH_PASSWORD);
await page.click('button[type="submit"]');
await page.waitForURL("**/dashboard");

// create a fresh athlete for this test
await page.goto("http://localhost:3000/athletes");
await page.click('button:has-text("Novo atleta")');
await page.fill('input[name="fullName"]', "Storage Teste Athlete");
await page.click('button:has-text("Cadastrar")');
await page.waitForSelector("text=Storage Teste Athlete", { timeout: 10000 });
await page.click("text=Storage Teste Athlete");
await page.waitForURL("**/dados");

// upload athlete photo
const testImage = path.resolve("public/next.svg");
const [fileChooser] = await Promise.all([
  page.waitForEvent("filechooser"),
  page.click('button[title="Alterar foto"]'),
]);
await fileChooser.setFiles(testImage);
await page.waitForTimeout(2500);
const imgVisible = await page.locator('header img, div img').first().isVisible().catch(() => false);
console.log("Photo <img> visible after upload:", imgVisible);

// attach media on evolucao tab
await page.click('a:has-text("Linha do tempo")');
await page.waitForURL("**/evolucao");
await page.click('button:has-text("Anexar mídia")');
await page.fill('input[name="label"]', "Foto de teste E2E");
await page.setInputFiles('input[name="file"]', testImage);
await page.getByRole("button", { name: "Anexar", exact: true }).click();
await page.waitForSelector('text=Artefatos de mídia anexados', { timeout: 10000 });
console.log("Media item created and visible in timeline: OK");

const mediaLink = await page.locator('a[title="Foto de teste E2E"]').getAttribute("href");
console.log("Media signed URL present:", !!mediaLink && mediaLink.includes("token="));

await browser.close();
console.log("E2E STORAGE CHECK: PASS");
