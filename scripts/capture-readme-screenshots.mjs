/**
 * Capture README screenshots (1280×720, light theme, demo branding).
 * Usage: node scripts/capture-readme-screenshots.mjs
 */
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, "..");
const outDir = path.join(repoRoot, "docs", "screenshots");
const baseUrl = "http://127.0.0.1:3445";
const registryPath = path.join(repoRoot, "config", "agents.registry.json");
const demoRegistryPath = path.join(outDir, ".demo-agents.registry.json");
const registryBackup = path.join(repoRoot, "_scratch", "agents.registry.json.screenshot-backup");
const appStatePath = path.join(
  process.env.LOCALAPPDATA ?? path.join(process.env.USERPROFILE ?? "", "AppData", "Local"),
  "ASI Agents",
  "app-state.json"
);
const appStateBackup = path.join(repoRoot, "_scratch", "app-state.json.screenshot-backup");

const PREFIX = "asi.default.";

function initLocalStorageScript() {
  return `
    localStorage.setItem('${PREFIX}displayName', 'Boss');
    localStorage.setItem('${PREFIX}locked', '0');
    localStorage.setItem('${PREFIX}showSquari', '1');
    localStorage.setItem('${PREFIX}squariSkin', 'squari');
    localStorage.setItem('${PREFIX}agentPanelOpen', '1');
    localStorage.setItem('${PREFIX}homeHeroVisible', '1');
    localStorage.setItem('${PREFIX}modelsOnboardingDone', '1');
  `;
}

async function api(method, route, body) {
  const res = await fetch(`${baseUrl}${route}`, {
    method,
    headers: body ? { "Content-Type": "application/json" } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  if (!res.ok && method !== "DELETE") {
    const t = await res.text().catch(() => "");
    throw new Error(`${method} ${route} → ${res.status} ${t.slice(0, 200)}`);
  }
  return res;
}

async function setHomeMode(mode) {
  await api("PUT", "/api/prefs", {
    activeProfile: "work",
    profiles: { work: { homeMode: mode }, personal: { homeMode: mode } },
  });
}

function backupAppState() {
  if (!fs.existsSync(appStatePath)) return;
  fs.mkdirSync(path.dirname(appStateBackup), { recursive: true });
  if (!fs.existsSync(appStateBackup)) {
    fs.copyFileSync(appStatePath, appStateBackup);
  }
}

function sanitizeAppStateForScreenshots() {
  if (!fs.existsSync(appStatePath)) return;
  backupAppState();
  const state = JSON.parse(fs.readFileSync(appStatePath, "utf8"));
  state.agentDisplayNames = {};
  state.agentRoleLabels = {};
  state.chiefThread = [];
  fs.writeFileSync(appStatePath, JSON.stringify(state, null, 2));
}

function restoreAppState() {
  if (fs.existsSync(appStateBackup)) {
    fs.copyFileSync(appStateBackup, appStatePath);
  }
}

async function prepareDemoState() {
  sanitizeAppStateForScreenshots();
  await api("POST", "/api/onboarding", { path: "manual" });
  await api("DELETE", "/api/chief/thread");
  await setHomeMode("super");
}

async function swapRegistry() {
  fs.mkdirSync(path.dirname(registryBackup), { recursive: true });
  if (!fs.existsSync(registryBackup)) {
    fs.copyFileSync(registryPath, registryBackup);
  }
  fs.copyFileSync(demoRegistryPath, registryPath);
}

async function restoreRegistry() {
  if (fs.existsSync(registryBackup)) {
    fs.copyFileSync(registryBackup, registryPath);
  }
  restoreAppState();
}

async function unlockIfNeeded(page) {
  const locked = await page.locator('button:has-text("Unlock")').first().isVisible().catch(() => false);
  if (locked) {
    await page.locator('button:has-text("Unlock")').first().click();
    await page.waitForTimeout(800);
  }
}

async function shot(page, name, url, opts = {}) {
  const { mode, waitMs = 1200, beforeNavigate, afterLoad, readySelector } = opts;
  if (mode) await setHomeMode(mode);
  if (beforeNavigate) await beforeNavigate(page);
  await page.goto(url, { waitUntil: "networkidle", timeout: 60_000 });
  await unlockIfNeeded(page);
  if (afterLoad) await afterLoad(page);
  if (readySelector) {
    await page.waitForSelector(readySelector, { timeout: 30_000 }).catch(() => {});
  }
  await page.waitForTimeout(waitMs);
  const file = path.join(outDir, name);
  const tmp = `${file}.tmp`;
  await page.screenshot({ path: tmp, type: "png" });
  try {
    fs.renameSync(tmp, file);
  } catch {
    fs.copyFileSync(tmp, file);
    fs.unlinkSync(tmp);
  }
  console.log("wrote", file);
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  if (!fs.existsSync(demoRegistryPath)) {
    throw new Error(`Missing demo registry: ${demoRegistryPath}`);
  }

  await swapRegistry();
  await prepareDemoState();

  let browser;
  try {
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      viewport: { width: 1280, height: 720 },
      deviceScaleFactor: 1,
      colorScheme: "light",
    });
    await context.addInitScript(initLocalStorageScript());
    const page = await context.newPage();

    await shot(page, "01-home.png", `${baseUrl}/`, {
      mode: "super",
      waitMs: 2000,
      readySelector: 'section[aria-label="Your thread with Chief"], h2:has-text("Chief")',
    });

    await shot(page, "02-simple-chat.png", `${baseUrl}/chat/chief`, {
      mode: "super",
      waitMs: 1800,
      readySelector: 'h1:has-text("Chief"), [aria-label="Virtual Computer"]',
      beforeNavigate: async (p) => {
        await p.evaluate(() => {
          localStorage.setItem("asi.default.agentPanelOpen", "1");
          localStorage.setItem("asi.default.locked", "0");
          localStorage.setItem("asi.default.showSquari", "0");
        });
      },
      afterLoad: async (p) => {
        await p.evaluate(() => document.querySelector("[data-companion]")?.remove());
        const openBtn = p.getByRole("button", { name: /^Open$/i });
        if (await openBtn.isVisible().catch(() => false)) await openBtn.click();
        await p.getByRole("button", { name: "What the agent sees" }).first().click({ force: true, timeout: 8000 });
        await p.waitForSelector("text=Terminal", { timeout: 8000 }).catch(() => {});
        const rail = p.locator('[aria-label="Agent details"]');
        await rail.evaluate((el) => {
          el.scrollTop = el.scrollHeight;
        }).catch(() => {});
        await p.waitForTimeout(500);
      },
    });

    await shot(page, "03-pro-dashboard.png", `${baseUrl}/agents?view=org`, {
      mode: "pro",
      waitMs: 2200,
      readySelector: 'h1:has-text("Agents")',
      afterLoad: async (p) => {
        await p.getByRole("tab", { name: /Org chart/i }).click().catch(() => {});
        await p.waitForTimeout(400);
      },
    });

    await shot(page, "04-companion.png", `${baseUrl}/chat/chief`, {
      mode: "super",
      waitMs: 2000,
      readySelector: 'h1:has-text("Chief")',
      beforeNavigate: async (p) => {
        await p.evaluate(() => {
          localStorage.setItem("asi.default.showSquari", "1");
          localStorage.setItem("asi.default.locked", "0");
        });
      },
    });

    await shot(page, "05-ams-handoff.png", `${baseUrl}/settings/models`, {
      mode: "pro",
      waitMs: 2500,
      readySelector: 'button:has-text("Models")',
      afterLoad: async (p) => {
        await p.getByRole("tab", { name: /Agent assignments/i }).click();
        await p.waitForTimeout(600);
        await p.getByText("Chief", { exact: false }).first().scrollIntoViewIfNeeded().catch(() => {});
      },
    });

    await context.close();
  } finally {
    if (browser) await browser.close();
    await restoreRegistry();
  }
}

main().catch((err) => {
  console.error(err);
  restoreRegistry().catch(() => {});
  process.exit(1);
});
