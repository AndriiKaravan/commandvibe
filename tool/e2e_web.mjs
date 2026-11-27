// Web join flow in headless Chrome against a test-mode server.
// Run: (server) PORT=3000 npm run start:test; (app) flutter build web --dart-define=API=http://localhost:3000; then
//   NODE_PATH=<dir with puppeteer-core> node tool/e2e_web.mjs   (serves app/build/web on :8080 itself)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const puppeteer = require('puppeteer-core');

const app = process.env.APP ?? 'http://localhost:8080/';
const api = process.env.API ?? 'http://localhost:3000';
const chrome = process.env.CHROME ?? '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';

async function post(path, body) {
  const response = await fetch(`${api}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (response.status !== 201) throw new Error(`${path} → ${response.status} ${await response.text()}`);
  return response.json();
}

async function waitText(page, text, timeout = 20000) {
  await page.waitForFunction(
    (t) => [...document.querySelectorAll('[aria-label], flt-semantics')].some((e) =>
      (e.getAttribute('aria-label') ?? e.textContent ?? '').includes(t)),
    { timeout },
    text,
  );
}

// Each step of the flow has one text field; locale-independent.
async function fill(page, value) {
  await page.waitForSelector('input', { timeout: 20000 });
  // During a page transition the previous screen's field is still in the DOM; the new one comes last.
  const inputs = await page.$$('input');
  await inputs[inputs.length - 1].click();
  // Flutter re-attaches its text editing host on focus; keys typed at once can land nowhere.
  await new Promise((resolve) => setTimeout(resolve, 500));
  await page.keyboard.type(value, { delay: 30 });
}

const webRoot = fileURLToPath(new URL('../app/build/web/', import.meta.url));
const types = { '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm', '.png': 'image/png', '.otf': 'font/otf', '.ttf': 'font/ttf' };
// Hosting rewrites every unknown path to index.html; so does this server.
const server = createServer((req, res) => {
  const path = normalize(decodeURIComponent(new URL(req.url, 'http://x').pathname)).replace(/^([.][.][/\\])+/, '');
  let file = join(webRoot, path);
  if (!file.startsWith(webRoot) || !existsSync(file) || statSync(file).isDirectory()) file = join(webRoot, 'index.html');
  res.setHeader('content-type', types[extname(file)] ?? 'application/octet-stream');
  createReadStream(file).pipe(res);
}).listen(8080);

// A game that started today, so the home screen has a task of the day to show.
const { token } = await post('/test/seed-group', { name: 'Web group', game: { mode: 'auto' } });
const browser = await puppeteer.launch({ executablePath: chrome, headless: true });
try {
  const page = await browser.newPage();
  await page.setViewport({ width: 400, height: 860 });
  await page.goto(`${app}join?t=${token}`, { waitUntil: 'load' });
  await page.waitForSelector('flt-semantics-placeholder', { timeout: 60000 });
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
  await waitText(page, 'Web group');
  console.log('invite page opened the join screen');
  await fill(page, 'Webby');
  await page.keyboard.press('Enter');
  await waitText(page, 'PIN');
  console.log('PIN screen');
  // The PIN field is autofocused; a click would move focus away from Flutter's editing host.
  await new Promise((resolve) => setTimeout(resolve, 800));
  await page.keyboard.type('1357', { delay: 30 });
  await page.keyboard.press('Enter');
  await waitText(page, 'Webby');
  console.log('joined and set a PIN');
  await waitText(page, 'Завдання дня');
  console.log('today card shows the task of the day');

  await post('/join', { token, displayName: 'Other' });
  await waitText(page, 'Other');
  console.log('new member arrived live');
} finally {
  await browser.close();
  server.close();
}
