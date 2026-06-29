import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(__dirname, '../../../..');
const AUTH_STATE_PATH = resolve(ROOT, '.claude/.auth/auth-state.json');
const CAPTURE_ROUTES_PATH = resolve(ROOT, '.claude/skills/capture-page/capture-routes.json');

const LOGIN_WAIT = parseInt(process.env.LOGIN_WAIT || '90', 10);

/**
 * 功能验收截图工具
 *
 * 用法：
 *   路由模式：node acceptance-capture.mjs <产品名> <页面1,页面2,...|all> <输出目录>
 *   URL 模式：node acceptance-capture.mjs <URL> <页面名> <输出目录>
 *
 * 输出：
 *   <输出目录>/<页面名>.png          — 视口截图
 *   <输出目录>/<页面名>-full.png     — 全页截图
 */

async function ensureLogin(page, entryUrl) {
  const loginHost = process.env.LOGIN_HOST || new URL(entryUrl).host;
  const isLoggedIn = (url) =>
    !url.includes('authing') &&
    !url.includes('login') &&
    url.includes(loginHost);

  console.log(`Navigating to ${entryUrl} ...`);
  console.log(`Login host pattern: ${loginHost}`);
  await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);

  if (isLoggedIn(page.url())) {
    console.log('Already logged in!');
    return;
  }

  console.log(`\nLogin required. Waiting ${LOGIN_WAIT}s for manual login...`);
  console.log('Please login in the Edge window.\n');

  const startTime = Date.now();
  let loggedIn = false;
  while (Date.now() - startTime < LOGIN_WAIT * 1000) {
    await page.waitForTimeout(5000);
    if (isLoggedIn(page.url())) {
      console.log('Login detected!');
      loggedIn = true;
      break;
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  Waiting... (${elapsed}s / ${LOGIN_WAIT}s)`);
  }

  if (!loggedIn) {
    loggedIn = isLoggedIn(page.url());
  }

  if (!loggedIn) {
    throw new Error(`Login timeout after ${LOGIN_WAIT}s. Run with LOGIN_WAIT=180 for more time.`);
  }

  console.log('Re-navigating to entry page...');
  await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
}

async function navigateToPage(page, entryUrl, navSteps) {
  await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);

  for (const step of navSteps) {
    if (step.action === 'click') {
      const locator = page.locator(step.selector);
      const target = typeof step.nth === 'number' ? locator.nth(step.nth) : locator.first();
      const count = await target.count();
      if (count === 0) {
        throw new Error(`Navigation failed: element not found - ${step.selector}`);
      }
      console.log(`  Clicking: ${step.selector}${step.nth != null ? ` [nth=${step.nth}]` : ''}`);
      await target.click();
      await page.waitForLoadState('networkidle', { timeout: 120000 }).catch(() => {});
      await page.waitForTimeout(3000);
    }
  }
}

async function captureScreenshots(page, pageName, outputDir) {
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });

  // 视口截图
  const viewportPath = resolve(outputDir, `${pageName}.png`);
  await page.screenshot({ path: viewportPath });
  console.log(`  Viewport screenshot: ${viewportPath}`);

  // 全页截图
  const fullPath = resolve(outputDir, `${pageName}-full.png`);
  await page.screenshot({ path: fullPath, fullPage: true });
  console.log(`  Full-page screenshot: ${fullPath}`);

  return { viewport: viewportPath, full: fullPath };
}

async function main() {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];
  const outputDir = process.argv[4];

  if (!arg1 || !outputDir) {
    console.error('Usage:');
    console.error('  Route mode:  node acceptance-capture.mjs <product> <page1,page2,...|all> <output-dir>');
    console.error('  URL mode:    node acceptance-capture.mjs <URL> <page-name> <output-dir>');
    process.exit(1);
  }

  const isUrlMode = arg1.startsWith('http');

  let productConfig = null;
  let productName = '';
  let pageNames = [];

  if (!isUrlMode) {
    if (!existsSync(CAPTURE_ROUTES_PATH)) {
      console.error(`Route config not found: ${CAPTURE_ROUTES_PATH}`);
      console.error('Create it first, or use URL mode.');
      process.exit(1);
    }
    const config = JSON.parse(readFileSync(CAPTURE_ROUTES_PATH, 'utf-8'));
    productName = arg1;
    productConfig = config[productName];
    if (!productConfig) {
      console.error(`Product "${productName}" not found. Available: ${Object.keys(config).join(', ')}`);
      process.exit(1);
    }

    if (arg2 === 'all') {
      pageNames = Object.keys(productConfig.pages);
    } else if (arg2) {
      pageNames = arg2.split(',').map(s => s.trim());
    } else {
      pageNames = Object.keys(productConfig.pages);
    }

    for (const name of pageNames) {
      if (!productConfig.pages[name]) {
        console.error(`Page "${name}" not found. Available: ${Object.keys(productConfig.pages).join(', ')}`);
        process.exit(1);
      }
    }
  } else {
    pageNames = [arg2 || 'page'];
  }

  const hasAuthState = existsSync(AUTH_STATE_PATH);
  console.log(`\n=== Acceptance Screenshot Tool ===`);
  console.log(`Mode: ${isUrlMode ? 'URL' : 'Route'}`);
  console.log(`Output: ${outputDir}`);
  console.log(`Pages: ${pageNames.join(', ')}\n`);

  const browser = await chromium.launch({ headless: false, channel: 'msedge' });

  let context;
  if (hasAuthState) {
    console.log('Loading saved auth state...');
    const storageState = JSON.parse(readFileSync(AUTH_STATE_PATH, 'utf-8'));
    context = await browser.newContext({ storageState, viewport: { width: 1440, height: 900 } });
  } else {
    context = await browser.newContext({ viewport: { width: 1440, height: 900 } });
  }
  context.setDefaultTimeout(120000);
  context.setDefaultNavigationTimeout(120000);

  const page = await context.newPage();

  try {
    if (isUrlMode) {
      const url = arg1;
      const pageName = arg2 || 'page';
      await ensureLogin(page, url);

      console.log(`--- Capturing: ${pageName} ---`);
      const paths = await captureScreenshots(page, pageName, outputDir);
      console.log(`\nDone: ${JSON.stringify(paths)}`);

    } else {
      const entryUrl = process.env.ENTRY_URL_OVERRIDE || productConfig.entry;
      if (process.env.ENTRY_URL_OVERRIDE) {
        console.log(`Entry URL overridden by ENTRY_URL_OVERRIDE: ${entryUrl}`);
      }
      await ensureLogin(page, entryUrl);

      const newState = await context.storageState();
      writeFileSync(AUTH_STATE_PATH, JSON.stringify(newState, null, 2), 'utf-8');
      console.log('Auth state saved.\n');

      const results = [];
      for (const pageName of pageNames) {
        const pageConfig = productConfig.pages[pageName];
        const navSteps = pageConfig.nav || [];

        console.log(`--- Capturing: ${pageName} ---`);
        if (navSteps.length === 0) {
          await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
          await page.waitForTimeout(3000);
        } else {
          console.log(`  Navigating (${navSteps.length} steps)...`);
          await navigateToPage(page, entryUrl, navSteps);
        }

        const paths = await captureScreenshots(page, pageName, outputDir);
        results.push({ page: pageName, ...paths });
        console.log('');
      }

      console.log('=== Summary ===');
      for (const r of results) {
        console.log(`  ${r.page}: viewport=${r.viewport}, full=${r.full}`);
      }
    }
  } finally {
    try {
      const newState = await context.storageState();
      writeFileSync(AUTH_STATE_PATH, JSON.stringify(newState, null, 2), 'utf-8');
    } catch (e) { /* ignore */ }
    await browser.close();
  }

  console.log('\nDone.');
}

main().catch((err) => {
  console.error('Error:', err.message);
  process.exit(1);
});
