// Renders scripts/social/card.html to public/social-card.png (1200x630), the link-preview image.
// Run from the repo root with Playwright available: node scripts/social/render.mjs
import { chromium } from 'playwright';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const browser = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.goto(pathToFileURL(path.resolve('scripts/social/card.html')).href);
await page.screenshot({ path: 'public/social-card.png', animations: 'disabled' });
await browser.close();
