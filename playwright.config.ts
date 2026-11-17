import { defineConfig } from '@playwright/test';
import { existsSync } from 'node:fs';
const installedBrowser =
  process.env.MASAR_BROWSER_PATH ??
  [
    'C:/Users/Tliba/AppData/Local/Google/Chrome/Application/chrome.exe',
    'C:/Program Files/Google/Chrome/Application/chrome.exe',
    'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  ].find(existsSync);
export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: false,
  workers: 1,
  timeout: 75000,
  expect: { timeout: 12000 },
  reporter: 'list',
  outputDir: '.tmp/playwright-results',
  use: {
    baseURL: 'http://127.0.0.1:5174',
    viewport: { width: 1440, height: 1000 },
    headless: true,
    launchOptions: installedBrowser ? { executablePath: installedBrowser } : {},
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  webServer: {
    command: 'npm run dev -- --port 5174',
    url: 'http://127.0.0.1:5174',
    reuseExistingServer: !process.env.CI,
    timeout: 30000,
  },
});
