// Full-page screenshots of the site at phone and desktop width, using headless Chrome.
// Usage: node tools/shoot.mjs <baseUrl> <outDir> [page.html ...]
// Example: node tools/shoot.mjs http://localhost:8787 screenshots/after
import { spawn } from 'node:child_process';
import { mkdirSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const [base, outDir, ...pagesArg] = process.argv.slice(2);
const pages = pagesArg.length ? pagesArg : ['index.html', 'support.html', 'privacy.html'];
const widths = [{ name: 'phone', width: 390, scale: 2, mobile: true }, { name: 'desktop', width: 1440, scale: 1, mobile: false }];
const CHROME = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const port = 9333;

mkdirSync(outDir, { recursive: true });
const profile = mkdtempSync(join(tmpdir(), 'shoot-'));
const chrome = spawn(CHROME, ['--headless=new', '--disable-gpu', '--hide-scrollbars', `--remote-debugging-port=${port}`, `--user-data-dir=${profile}`, 'about:blank'], { stdio: 'ignore' });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let target;
for (let i = 0; i < 50 && !target; i++) {
  await sleep(200);
  try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
}
const ws = new WebSocket(target.webSocketDebuggerUrl);
await new Promise((r) => ws.addEventListener('open', r));
let id = 0; const pending = new Map(); const listeners = [];
ws.addEventListener('message', (e) => {
  const m = JSON.parse(e.data);
  if (m.id && pending.has(m.id)) { pending.get(m.id)(m); pending.delete(m.id); }
  else listeners.forEach((l) => l(m));
});
const send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
const once = (method) => new Promise((r) => { const l = (m) => { if (m.method === method) { listeners.splice(listeners.indexOf(l), 1); r(m); } }; listeners.push(l); });

await send('Page.enable');
const report = [];
for (const page of pages) {
  for (const w of widths) {
    await send('Emulation.setDeviceMetricsOverride', { width: w.width, height: 900, deviceScaleFactor: w.scale, mobile: w.mobile });
    const loaded = once('Page.loadEventFired');
    await send('Page.navigate', { url: `${base}/${page}` });
    await loaded;
    // Load lazy images so they appear in the full-page capture.
    await send('Runtime.evaluate', { awaitPromise: true, expression: `Promise.all([...document.images].map(i => { i.loading = 'eager'; return i.complete && i.naturalWidth ? 0 : new Promise(r => { i.onload = i.onerror = r; setTimeout(r, 5000); }); }))` });
    await sleep(400);
    const { result } = await send('Runtime.evaluate', { expression: 'JSON.stringify({h: document.documentElement.scrollHeight, sw: document.documentElement.scrollWidth, broken: [...document.images].filter(i => !i.complete || i.naturalWidth === 0).map(i => i.src)})', returnByValue: true });
    const info = JSON.parse(result.result.value);
    const shot = await send('Page.captureScreenshot', { format: 'png', captureBeyondViewport: true, clip: { x: 0, y: 0, width: w.width, height: info.h, scale: 1 } });
    const file = join(outDir, `${page.replace('.html', '')}-${w.name}.png`);
    writeFileSync(file, Buffer.from(shot.result.data, 'base64'));
    report.push(`${file}  height=${info.h}  horizontalOverflow=${info.sw > w.width}  brokenImages=${info.broken.length ? info.broken.join(',') : 'none'}`);
  }
}
console.log(report.join('\n'));
ws.close(); chrome.kill();
