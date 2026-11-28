// Web join flow in headless Chrome against a test-mode server.
// Run: (server) PORT=3000 npm run start:test; (app) flutter build web --dart-define=API=http://localhost:3000; then
//   NODE_PATH=<dir with puppeteer-core> node tool/e2e_web.mjs   (serves app/build/web on :8080 itself)
import { createReadStream, existsSync, statSync } from 'node:fs';
import { createServer } from 'node:http';
import { createRequire } from 'node:module';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';

const photoFixture = fileURLToPath(new URL('./fixtures/e2e-photo.jpg', import.meta.url));

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

// Taps the first semantics node whose label contains [text]; a real click, so the browser allows a file chooser.
async function tap(page, text) {
  let handle;
  try {
    handle = await page.waitForFunction(
      (t) => {
        const nodes = [...document.querySelectorAll('flt-semantics')];
        const label = (e) => e.getAttribute('aria-label') ?? e.textContent ?? '';
        // A container's label contains its children's; the exact label is the button itself.
        const visible = (e) => { const b = e.getBoundingClientRect(); return b.width > 0 && b.height > 0; };
        // The frontmost (last) visible exact match: tabs keep other screens mounted behind it.
        return nodes.filter((e) => label(e) === t && visible(e)).pop() ?? nodes.find((e) => label(e).includes(t)) ?? false;
      },
      { timeout: 20000 },
      text,
    );
  } catch (error) {
    const labels = await page.evaluate(() =>
      [...document.querySelectorAll('flt-semantics')].map((e) => e.getAttribute('aria-label') ?? e.textContent ?? '').filter(Boolean));
    throw new Error(`no "${text}" on screen; labels: ${JSON.stringify(labels)}`, { cause: error });
  }
  await handle.asElement().click();
}

async function sendPhoto(page, source) {
  await tap(page, 'Виконати');
  const [chooser] = await Promise.all([page.waitForFileChooser(), tap(page, source)]);
  await chooser.accept([photoFixture]);
  await waitText(page, 'Виконано');
}

// The whole join flow: invite page, name, PIN, group home.
async function joinAs(page, token, name, groupName) {
  await page.goto(`${app}join?t=${token}`, { waitUntil: 'load' });
  await page.waitForSelector('flt-semantics-placeholder', { timeout: 60000 });
  await page.evaluate(() => document.querySelector('flt-semantics-placeholder')?.click());
  await waitText(page, groupName);
  await fill(page, name);
  await page.keyboard.press('Enter');
  await waitText(page, 'PIN');
  // The PIN field is autofocused; a click would move focus away from Flutter's editing host.
  await new Promise((resolve) => setTimeout(resolve, 800));
  await page.keyboard.type('1357', { delay: 30 });
  await page.keyboard.press('Enter');
  await waitText(page, 'Завдання дня');
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
  await joinAs(page, token, 'Webby', 'Web group');
  console.log('joined, set a PIN and landed on the Today tab with the task of the day');

  await post('/join', { token, displayName: 'Other' });
  await tap(page, 'Я');
  await waitText(page, 'Other');
  console.log('new member arrived live on the Me tab');
  await tap(page, 'Сьогодні');

  // Photos: Webby sends one; a second member sees it blurred until they send their own.
  await sendPhoto(page, 'Обрати з галереї');
  console.log('Webby submitted a photo from the gallery');
  const second = await (await browser.createBrowserContext()).newPage();
  await second.setViewport({ width: 400, height: 860 });
  await joinAs(second, token, 'Bella', 'Web group');
  await waitText(second, 'Виконай завдання — і побач одразу');
  console.log('Bella sees the other photo blurred, with the invitation');
  await sendPhoto(second, 'Обрати з галереї');
  await second.waitForFunction(
    () => ![...document.querySelectorAll('[aria-label], flt-semantics')].some((e) =>
      (e.getAttribute('aria-label') ?? e.textContent ?? '').includes('Виконай завдання — і побач одразу')),
    { timeout: 20000 },
  );
  console.log('after her own photo, Bella sees the other one in full');
} finally {
  await browser.close();
  server.close();
}
