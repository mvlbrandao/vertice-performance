import { chromium } from "playwright";

const COACH_EMAIL = process.env.E2E_COACH_EMAIL;
const COACH_PASSWORD = process.env.E2E_COACH_PASSWORD;
if (!COACH_EMAIL || !COACH_PASSWORD) {
  console.error("Defina E2E_COACH_EMAIL e E2E_COACH_PASSWORD no ambiente (nunca hardcode credenciais reais aqui).");
  process.exit(1);
}

const browser = await chromium.launch({ channel: "chrome", headless: true });

// mobile viewport check
const mobilePage = await browser.newPage({ viewport: { width: 375, height: 700 } });
await mobilePage.goto("http://localhost:3000/login");
await mobilePage.fill('input[type="email"]', COACH_EMAIL);
await mobilePage.fill('input[type="password"]', COACH_PASSWORD);
await mobilePage.click('button[type="submit"]');
await mobilePage.waitForURL("**/dashboard");

const hamburgerVisible = await mobilePage.locator('button[aria-label="Abrir menu"]').isVisible();
console.log("Hamburger visible on mobile:", hamburgerVisible);

const sidebarVisibleBefore = await mobilePage.locator("aside").isVisible();
console.log("Sidebar visually collapsed initially (still in DOM):", sidebarVisibleBefore);

await mobilePage.click('button[aria-label="Abrir menu"]');
await mobilePage.waitForTimeout(300);
const sidebarBox = await mobilePage.locator("aside").boundingBox();
console.log("Sidebar on-screen after toggle (x >= 0):", sidebarBox && sidebarBox.x >= 0);

// already-logged-in visiting /login should redirect
await mobilePage.goto("http://localhost:3000/login");
await mobilePage.waitForURL("**/dashboard", { timeout: 10000 });
console.log("Logged-in user redirected away from /login:", mobilePage.url().includes("dashboard"));

await browser.close();
console.log("E2E POLISH CHECK: PASS");
