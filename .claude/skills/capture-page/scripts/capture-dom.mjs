import { chromium } from 'playwright';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const SKILL_DIR = resolve(__dirname, '..');
const ROOT = resolve(SKILL_DIR, '../../..');
const AUTH_STATE_PATH = resolve(ROOT, '.claude/.auth/auth-state.json');
const CONFIG_PATH = resolve(SKILL_DIR, 'capture-routes.json');

function getOutputDir(productName) {
  return resolve(ROOT, `products/${productName}/pages/dom`);
}

const LOGIN_WAIT = parseInt(process.env.LOGIN_WAIT || '90', 10);

/**
 * 导航路由配置格式（capture-routes.json）：
 * {
 *   "<产品名>": {
 *     "entry": "https://...",          // 入口 URL
 *     "pages": {
 *       "<页面名>": {
 *         "nav": [                     // 从入口到达该页面的导航步骤（可选，空数组=入口页本身）
 *           { "action": "click", "selector": "button:has-text('查看详情')", "nth": 0 },
 *           ...
 *         ]
 *       }
 *     }
 *   }
 * }
 *
 * 用法：
 *   单页面：node capture-dom.mjs <产品名> <页面名>
 *   多页面：node capture-dom.mjs <产品名> <页面1>,<页面2>,<页面3>
 *   全部：  node capture-dom.mjs <产品名> all
 *   单URL（兼容旧用法）：node capture-dom.mjs <URL> <输出名>
 */

async function extractDOM(page, customSelector) {
  return await page.evaluate((sel) => {
    if (sel) {
      const el = document.querySelector(sel);
      if (el) return { selector: sel, html: el.outerHTML };
      return { selector: sel, html: '', error: 'Custom selector not found' };
    }
    const selectors = [
      'main',
      '.main-container',
      '.app-main',
      '#app .main',
      '.el-main',
      '[class*="main-content"]',
      '[class*="page-content"]',
      '[class*="content-area"]',
      '#app',
    ];
    for (const s of selectors) {
      const el = document.querySelector(s);
      if (el) return { selector: s, html: el.outerHTML };
    }
    return { selector: 'body', html: document.body.outerHTML };
  }, customSelector);
}

async function extractStyles(page) {
  return await page.evaluate(() => {
    const styles = [];

    // 1. 提取所有 <style> 标签内容（含 Ant Design CSS-in-JS 注入的样式）
    const styleTags = document.querySelectorAll('style');
    for (const tag of styleTags) {
      if (tag.textContent.trim()) {
        styles.push(tag.textContent);
      }
    }

    // 2. 提取外链 CSS 文件的 href（同源的才能内联，跨域的保留 link 标签）
    const linkTags = document.querySelectorAll('link[rel="stylesheet"]');
    const externalLinks = [];
    for (const link of linkTags) {
      externalLinks.push(link.outerHTML);
    }

    // 3. 提取 :root 上的 CSS 变量（全局 token）
    const rootStyles = getComputedStyle(document.documentElement).cssText;

    return { inlineStyles: styles.join('\n'), externalLinks, rootStyles };
  });
}

async function saveDom(dom, styles, pageName, productName) {
  const outputDir = getOutputDir(productName);
  if (!existsSync(outputDir)) mkdirSync(outputDir, { recursive: true });
  const outputPath = resolve(outputDir, `${pageName}.html`);

  // 组合成完整独立 HTML，样式内联，可直接在浏览器打开
  const fullHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${pageName}</title>
  ${styles.externalLinks.join('\n  ')}
  <style>
${styles.inlineStyles}
  </style>
</head>
<body>
${dom.html}
</body>
</html>`;

  writeFileSync(outputPath, fullHtml, 'utf-8');
  return outputPath;
}

function isOnLoginPage(url) {
  return url.includes('authing') || url.includes('/login') || url.includes('oauth');
}

async function ensureLogin(page, entryUrl) {
  console.log(`Navigating to ${entryUrl} ...`);
  await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);

  const currentUrl = page.url();
  if (!isOnLoginPage(currentUrl)) {
    console.log('Already logged in!');
    return;
  }

  console.log(`\nLogin required. Waiting ${LOGIN_WAIT}s for manual login...`);
  console.log('Please login in the Edge window.\n');

  const startTime = Date.now();
  let loggedIn = false;
  while (Date.now() - startTime < LOGIN_WAIT * 1000) {
    await page.waitForTimeout(5000);
    const nowUrl = page.url();
    loggedIn = !isOnLoginPage(nowUrl);
    if (loggedIn) {
      console.log('Login detected!');
      break;
    }
    const elapsed = Math.round((Date.now() - startTime) / 1000);
    console.log(`  Waiting... (${elapsed}s / ${LOGIN_WAIT}s)`);
  }

  if (!loggedIn) {
    loggedIn = !isOnLoginPage(page.url());
  }

  if (!loggedIn) {
    throw new Error(`Login timeout after ${LOGIN_WAIT}s. Run with LOGIN_WAIT=180 for more time.`);
  }

  console.log('Re-navigating to entry page...');
  await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);
}

async function navigateToPage(page, entryUrl, navSteps) {
  // Go to entry first
  await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
  await page.waitForTimeout(3000);

  // Execute each navigation step
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

async function main() {
  const arg1 = process.argv[2];
  const arg2 = process.argv[3];

  if (!arg1) {
    console.error('Usage:');
    console.error('  Route mode:  node capture-dom.mjs <product> <page1,page2,...|all>');
    console.error('  URL mode:    node capture-dom.mjs <URL> [output-name]');
    process.exit(1);
  }

  // Detect mode: URL mode (starts with http) vs route mode
  const isUrlMode = arg1.startsWith('http');

  let productConfig = null;
  let productName = '';
  let pageNames = [];

  if (!isUrlMode) {
    // Route mode: load config
    if (!existsSync(CONFIG_PATH)) {
      console.error(`Route config not found: ${CONFIG_PATH}`);
      console.error('Create it first, or use URL mode: node capture-dom.mjs <URL> <name>');
      process.exit(1);
    }
    const config = JSON.parse(readFileSync(CONFIG_PATH, 'utf-8'));
    productName = arg1;
    productConfig = config[productName];
    if (!productConfig) {
      console.error(`Product "${productName}" not found in config. Available: ${Object.keys(config).join(', ')}`);
      process.exit(1);
    }

    if (arg2 === 'all') {
      pageNames = Object.keys(productConfig.pages);
    } else if (arg2) {
      pageNames = arg2.split(',').map(s => s.trim());
    } else {
      pageNames = Object.keys(productConfig.pages);
    }

    // Validate page names
    for (const name of pageNames) {
      if (!productConfig.pages[name]) {
        console.error(`Page "${name}" not found for ${productName}. Available: ${Object.keys(productConfig.pages).join(', ')}`);
        process.exit(1);
      }
    }
  }

  // Launch browser
  const hasAuthState = existsSync(AUTH_STATE_PATH);
  console.log(`\n=== DOM Capture Tool ===`);
  console.log(`Mode: ${isUrlMode ? 'URL' : 'Route'}`);
  console.log(`Auth state: ${hasAuthState ? 'found' : 'not found'}\n`);

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
      // === URL mode (backward compatible) ===
      const url = arg1;
      const outputName = arg2 || 'capture';
      const urlProductName = process.argv[4] || '_misc';

      await ensureLogin(page, url);

      console.log('Extracting DOM and styles...');
      const dom = await extractDOM(page, null);
      const styles = await extractStyles(page);
      console.log(`Matched selector: ${dom.selector}`);
      console.log(`DOM size: ${(dom.html.length / 1024).toFixed(1)} KB`);
      console.log(`Styles: ${styles.inlineStyles.length} chars inline, ${styles.externalLinks.length} external links`);

      const outputPath = await saveDom(dom, styles, outputName, urlProductName);
      console.log(`\nDOM saved to: ${outputPath}`);

    } else {
      // === Route mode ===
      const entryUrl = productConfig.entry;

      // Login once
      await ensureLogin(page, entryUrl);

      // Save auth state
      const newState = await context.storageState();
      writeFileSync(AUTH_STATE_PATH, JSON.stringify(newState, null, 2), 'utf-8');
      console.log('Auth state saved.\n');

      // Capture each page
      const results = [];
      for (const pageName of pageNames) {
        const pageConfig = productConfig.pages[pageName];
        const navSteps = pageConfig.nav || [];

        console.log(`--- Capturing: ${pageName} ---`);
        if (navSteps.length === 0) {
          console.log('  Entry page (no navigation needed)');
          await page.goto(entryUrl, { waitUntil: 'networkidle', timeout: 120000 });
          await page.waitForTimeout(3000);
        } else {
          console.log(`  Navigating (${navSteps.length} steps)...`);
          await navigateToPage(page, entryUrl, navSteps);
        }

        console.log('  Extracting DOM and styles...');
        const customSelector = pageConfig.domSelector || null;
        const dom = await extractDOM(page, customSelector);
        const styles = await extractStyles(page);
        console.log(`  Matched selector: ${dom.selector}`);
        console.log(`  DOM size: ${(dom.html.length / 1024).toFixed(1)} KB`);
        console.log(`  Styles: ${styles.inlineStyles.length} chars inline, ${styles.externalLinks.length} external links`);

        const outputPath = await saveDom(dom, styles, pageName, productName);
        console.log(`  Saved to: ${outputPath}\n`);
        results.push({ page: pageName, size: dom.html.length, path: outputPath });
      }

      console.log('=== Summary ===');
      for (const r of results) {
        console.log(`  ${r.page}: ${(r.size / 1024).toFixed(1)} KB -> ${r.path}`);
      }
    }
  } finally {
    // Always save auth state
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
