// Usage: node watch.js <video-url> <out-dir> [frames=8]
// Opens a public video page in headless Chromium, plays it muted, saves evenly spaced frames
// (<out-dir>/frame-NN.png), page text (meta.json) and links to related videos. Prints a JSON summary.
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

(async () => {
  const [url, out, framesArg] = process.argv.slice(2);
  if (!url || !out) { console.error('usage: node watch.js <video-url> <out-dir> [frames]'); process.exit(2); }
  const frames = Math.max(2, Math.min(24, parseInt(framesArg || '8', 10)));
  fs.mkdirSync(out, { recursive: true });

  const browser = await chromium.launch({ args: ['--autoplay-policy=no-user-gesture-required'] });
  const ctx = await browser.newContext({
    viewport: { width: 430, height: 900 }, deviceScaleFactor: 1,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
  });
  const page = await ctx.newPage();
  const blocked = new Set();
  page.on('requestfailed', (r) => { try { blocked.add(new URL(r.url()).host); } catch {} });
  const summary = { url, frames: [], blockedHosts: [], related: [], notes: [] };

  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForTimeout(6000);
  // Dismiss "open the app" interstitials if present.
  for (const label of ['Continue on web', 'Not now', 'Close']) {
    const el = page.getByText(label, { exact: true }).first();
    if (await el.count().catch(() => 0)) { await el.click({ timeout: 2000 }).catch(() => {}); }
  }
  summary.title = await page.title();
  summary.description = await page.evaluate(() => (document.querySelector('meta[property="og:description"]') || {}).content || null);

  const hasVideo = await page.evaluate(() => !!document.querySelector('video'));
  if (!hasVideo) summary.notes.push('No <video> element found (login wall, bot check, or blocked hosts).');
  else {
    await page.evaluate(async () => {
      const v = document.querySelector('video'); v.muted = true; v.loop = false;
      try { await v.play(); } catch {}
    });
    await page.waitForTimeout(2500);
    const dur = await page.evaluate(() => { const v = document.querySelector('video'); return isFinite(v.duration) ? v.duration : 0; });
    summary.duration = dur;
    const box = page.locator('video').first();
    for (let i = 0; i < frames; i++) {
      const t = dur ? (dur * (i + 0.5)) / frames : i * 2;
      await page.evaluate((t) => new Promise((res) => {
        const v = document.querySelector('video'); v.pause();
        const done = () => { v.removeEventListener('seeked', done); res(); };
        v.addEventListener('seeked', done); v.currentTime = t; setTimeout(res, 3000);
      }), t);
      await page.waitForTimeout(500);
      const file = path.join(out, `frame-${String(i).padStart(2, '0')}.png`);
      await page.screenshot({ path: file }); // full viewport: video plus caption, so overlays are visible too
      summary.frames.push({ file, t: Math.round(t * 10) / 10 });
    }
  }

  summary.pageText = await page.evaluate(() => document.body.innerText.slice(0, 1500));
  summary.related = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href*="/video/"]')].map((a) => a.href))].slice(0, 30));
  summary.blockedHosts = [...blocked].filter((h) => !/google|doubleclick/.test(h));
  fs.writeFileSync(path.join(out, 'meta.json'), JSON.stringify(summary, null, 2));
  console.log(JSON.stringify({ ...summary, pageText: summary.pageText.slice(0, 300) }, null, 2));
  await browser.close();
})().catch((e) => { console.error('ERROR', e.message); process.exit(1); });
