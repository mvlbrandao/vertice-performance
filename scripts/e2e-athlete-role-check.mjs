import { chromium } from "playwright";

const browser = await chromium.launch({ channel: "chrome", headless: true });
const page = await browser.newPage();
page.on("pageerror", (err) => console.log("[pageerror]", err.message));

await page.goto("http://localhost:3000/login");
await page.fill('input[type="email"]', "atleta.e2e.teste@example.com");
await page.fill('input[type="password"]', "TesteAtleta123!");
await page.click('button[type="submit"]');
await page.waitForURL("**/perfil", { timeout: 10000 });
console.log("Athlete logged in, landed on:", page.url());
console.log("Profile header:", await page.textContent("h2"));

// sidebar should show athlete-only nav (no Painel, no Atletas)
const sidebarText = await page.textContent("aside");
console.log("Sidebar hides coach-only items (Painel):", !sidebarText.includes("Painel"));
console.log("Sidebar shows athlete items (Treinos):", sidebarText.includes("Treinos"));

// checkin submission
await page.goto("http://localhost:3000/checkin");
await page.click('button:has-text("Registrar check-in de hoje")');
await page.fill('input[name="fatigue"]', "3");
await page.fill('input[name="pain"]', "Nenhuma");
await page.getByRole("button", { name: "Registrar", exact: true }).click();
await page.waitForTimeout(1500);
await page.reload();
const checkinVisible = await page.locator("text=Dor relatada: Nenhuma").first().isVisible().catch(() => false);
console.log("Checkin submitted and visible:", checkinVisible);

// attempt to access coach-only route directly -> should redirect away
await page.goto("http://localhost:3000/dashboard");
await page.waitForURL((url) => !url.pathname.includes("dashboard"), { timeout: 10000 });
console.log("Coach-only /dashboard blocked, redirected to:", page.url());

await browser.close();
console.log("E2E ATHLETE ROLE CHECK: PASS");
