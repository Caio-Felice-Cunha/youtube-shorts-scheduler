// Upload ONE video to YouTube and either schedule it or publish it now, by
// driving the YouTube Studio wizard in your attached Chrome.
//
//   node src/upload.mjs --video ./videos/clip.mp4 --title "My title" \
//        --description "..." --publish-at "2026-01-15 09:00"
//   node src/upload.mjs --video ./videos/clip.mp4 --title "My title" --privacy public
//
// publishAt is "YYYY-MM-DD HH:mm" in YOUR channel's timezone. Omit it to publish
// now at --privacy public|private|unlisted.
import fs from 'node:fs';
import path from 'node:path';
import { connectCDP, parseArgs, sleep } from './browser.mjs';

function formatDateLabel(datePart) {
  const d = new Date(`${datePart}T00:00:00`);
  return `${d.toLocaleString('en-US', { month: 'short' })} ${d.getDate()}, ${d.getFullYear()}`;
}
function formatTimeLabel(timePart) {
  const [hh, mm] = String(timePart || '00:00').split(':').map(Number);
  const mer = hh < 12 ? 'AM' : 'PM';
  let h12 = hh % 12; if (h12 === 0) h12 = 12;
  return `${h12}:${String(mm).padStart(2, '0')} ${mer}`;
}

async function setText(page, selector, text) {
  const el = page.locator(selector).first();
  await el.waitFor({ state: 'visible', timeout: 20000 });
  await el.click();
  await page.keyboard.press('Control+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(text);
}

// YouTube gates wizard buttons with aria-disabled, which Playwright's .click()
// ignores. Clicking #next-button or #done-button while disabled silently saves a
// PRIVATE DRAFT (no publishAt). So always wait until the button is truly enabled.
async function clickWhenEnabled(page, selector, timeoutMs = 120000) {
  const el = page.locator(selector).first();
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await el.count()) {
      const aria = await el.getAttribute('aria-disabled').catch(() => null);
      if (aria !== 'true') { await el.click(); return; }
    }
    await sleep(1000);
  }
  throw new Error(`"${selector}" never became enabled within ${timeoutMs}ms`);
}

async function clickNext(page) {
  await clickWhenEnabled(page, '#next-button');
  await sleep(2500);
}

// The ad-suitability self-rating step only appears on monetized channels.
async function handleAdSuitabilityIfPresent(page) {
  const none = page.getByText('None of the above', { exact: true }).first();
  if (!(await none.count())) return false;
  await none.scrollIntoViewIfNeeded().catch(() => {});
  await none.click().catch(() => {});
  await sleep(1500);
  const submit = page.locator('ytcp-button:has-text("Submit rating"), button:has-text("Submit rating")').first();
  if (await submit.count()) {
    await submit.scrollIntoViewIfNeeded().catch(() => {});
    await submit.click().catch(() => {});
    await sleep(1500);
  }
  return true;
}

export async function uploadVideo(context, entry) {
  const { file, title, description = '', publishAt, privacy = 'public', madeForKids = false } = entry;
  const videoPath = path.resolve(file);
  if (!fs.existsSync(videoPath)) throw new Error(`video not found: ${videoPath}`);
  if (!title) throw new Error('a title is required');

  const page = await context.newPage();
  page.setDefaultTimeout(30000);
  try {
    await page.goto('https://www.youtube.com/upload', { waitUntil: 'domcontentloaded' });
    await sleep(4000);

    // Inject the file straight into the <input type=file> via CDP — instant, no
    // OS file dialog, no size cap (Playwright setInputFiles hangs on big files).
    const client = await page.context().newCDPSession(page);
    await client.send('DOM.enable');
    const { root } = await client.send('DOM.getDocument', { depth: -1 });
    const { nodeId } = await client.send('DOM.querySelector', { nodeId: root.nodeId, selector: 'input[type="file"]' });
    if (!nodeId) throw new Error('upload file input not found');
    await client.send('DOM.setFileInputFiles', { nodeId, files: [videoPath] });

    // Details step
    await page.locator('#title-textarea #textbox').first().waitFor({ state: 'visible', timeout: 120000 });
    await sleep(1500);
    await setText(page, '#title-textarea #textbox', String(title).slice(0, 100));
    if (description) await setText(page, '#description-textarea #textbox', String(description));
    const kids = madeForKids ? 'VIDEO_MADE_FOR_KIDS_MFK' : 'VIDEO_MADE_FOR_KIDS_NOT_MFK';
    await page.locator(`tp-yt-paper-radio-button[name="${kids}"]`).first().click({ timeout: 20000 });
    await sleep(800);

    // Advance to Visibility. Step count varies (ad-suitability only on monetized
    // channels), so loop Next until the visibility radios appear.
    for (let i = 0; i < 8; i += 1) {
      if (await page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').count()) break;
      await handleAdSuitabilityIfPresent(page);
      if (await page.locator('tp-yt-paper-radio-button[name="PUBLIC"]').count()) break;
      await clickNext(page);
    }
    await page.locator('tp-yt-paper-radio-button[name="PUBLIC"], tp-yt-paper-radio-button[name="PRIVATE"]')
      .first().waitFor({ state: 'visible', timeout: 30000 });

    let result;
    if (publishAt) {
      const [datePart, timePart] = String(publishAt).trim().split(/\s+/);
      const dateLabel = formatDateLabel(datePart);
      const timeLabel = formatTimeLabel(timePart);
      // pick "Schedule"
      let ok = false;
      for (let a = 0; a < 4 && !ok; a += 1) {
        try {
          const r = page.getByText('Schedule', { exact: true }).first();
          await r.waitFor({ state: 'visible', timeout: 15000 });
          await r.scrollIntoViewIfNeeded();
          await r.click();
          ok = true;
        } catch { await sleep(2500); }
      }
      if (!ok) throw new Error('could not click the Schedule option');
      await sleep(1500);
      // date
      await page.locator('#datepicker-trigger:not([disabled])').first().click();
      await sleep(1000);
      const dateInput = page.locator('tp-yt-iron-dropdown input, ytcp-date-picker input').first();
      await dateInput.click();
      await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
      await page.keyboard.insertText(dateLabel);
      await page.keyboard.press('Enter');
      await sleep(1000);
      // time (defaults to "12:00 AM")
      const timeInput = page.locator('tp-yt-paper-input#textbox input:visible').first();
      await timeInput.click();
      await page.keyboard.press('Control+A'); await page.keyboard.press('Delete');
      await page.keyboard.insertText(timeLabel);
      await page.keyboard.press('Enter');
      await sleep(900);
      // read back; refuse to finalize on mismatch (don't post at the wrong time)
      const rb = await page.evaluate(() => {
        const date = ((document.querySelector('#datepicker-trigger') || {}).innerText || '').trim();
        const t = document.querySelector('tp-yt-paper-input#textbox input');
        return { date, time: t ? t.value : null };
      });
      if (rb.date !== dateLabel || String(rb.time || '').replace(/\s+/g, ' ').trim() !== timeLabel) {
        throw new Error(`schedule mismatch: wanted "${dateLabel}" "${timeLabel}", got "${rb.date}" "${rb.time}"`);
      }
      result = { scheduled: true, publishAt, readback: rb };
    } else {
      const priv = String(privacy).toUpperCase();
      if (!['PUBLIC', 'PRIVATE', 'UNLISTED'].includes(priv)) throw new Error(`invalid privacy: ${privacy}`);
      await page.locator(`tp-yt-paper-radio-button[name="${priv}"]`).first().click({ timeout: 15000 });
      await sleep(800);
      result = { scheduled: false, privacy: priv.toLowerCase() };
    }

    // Finalize. #done-button is aria-disabled while the upload is still
    // processing — wait for it to enable, then click.
    await clickWhenEnabled(page, '#done-button');
    await sleep(5000);
    return { ok: true, file: path.basename(videoPath), ...result };
  } finally {
    await page.close().catch(() => {});
  }
}

// ── CLI ──────────────────────────────────────────────────────────────────────
if (process.argv[1] && path.basename(process.argv[1]) === 'upload.mjs') {
  const a = parseArgs(process.argv);
  if (!a.video || !a.title) {
    console.error('usage: node src/upload.mjs --video <path> --title "..." [--description "..."] [--publish-at "YYYY-MM-DD HH:mm"] [--privacy public|private|unlisted] [--made-for-kids]');
    process.exit(2);
  }
  const { context } = await connectCDP();
  try {
    const res = await uploadVideo(context, {
      file: a.video,
      title: a.title,
      description: a.description || '',
      publishAt: a['publish-at'],
      privacy: a.privacy || 'public',
      madeForKids: !!a['made-for-kids'],
    });
    console.log(JSON.stringify(res));
    process.exit(res.ok ? 0 : 1);
  } catch (err) {
    console.log(JSON.stringify({ ok: false, error: (err && err.message) || String(err) }));
    process.exit(1);
  }
}
