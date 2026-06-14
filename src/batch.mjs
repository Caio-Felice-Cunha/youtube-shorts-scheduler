// Upload/schedule every entry in a manifest, one at a time, with a gap between
// each. Resumable: finished uploads are recorded and skipped on re-run.
//
//   node src/batch.mjs                      # uses ./manifest.json
//   node src/batch.mjs --manifest my.json --spacing 3
import fs from 'node:fs';
import { connectCDP, parseArgs, sleep } from './browser.mjs';
import { config, resolveVideoPath } from './config.mjs';
import { uploadVideo } from './upload.mjs';

const a = parseArgs(process.argv);
const MANIFEST = a.manifest || 'manifest.json';
const STATE = a.state || '.posted.json';
const SPACING_MIN = a.spacing ? Number(a.spacing) : config.batchSpacingMinutes;
const log = (...m) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...m);

if (!fs.existsSync(MANIFEST)) {
  console.error(`manifest not found: ${MANIFEST} (copy manifest.example.json to manifest.json and edit it)`);
  process.exit(2);
}
const items = JSON.parse(fs.readFileSync(MANIFEST, 'utf8'));
const prior = fs.existsSync(STATE) ? (JSON.parse(fs.readFileSync(STATE, 'utf8')).done || []) : [];
const doneSet = new Set(prior);

const { context } = await connectCDP();
log(`${items.length} entries; ${doneSet.size} already done; ${SPACING_MIN} min between uploads`);
let count = 0;
for (let i = 0; i < items.length; i += 1) {
  const it = items[i];
  if (doneSet.has(it.file)) { log(`[${i + 1}/${items.length}] skip (done): ${it.file}`); continue; }
  log(`[${i + 1}/${items.length}] uploading: ${it.file}`);
  try {
    const res = await uploadVideo(context, { ...it, file: resolveVideoPath(it.file) });
    if (!res || !res.ok) throw new Error('upload did not complete');
    doneSet.add(it.file);
    fs.writeFileSync(STATE, JSON.stringify({ done: [...doneSet], updated: new Date().toISOString() }, null, 2));
    count += 1;
    log(`OK ${it.file} — ${count} this run, ${doneSet.size}/${items.length} total`);
  } catch (err) {
    log(`FAILED ${it.file}: ${(err && err.message) || err}`);
    log('Stopping. Fix it and re-run — finished uploads are skipped.');
    break;
  }
  if (i < items.length - 1 && !doneSet.has(items[i + 1]?.file)) {
    log(`waiting ${SPACING_MIN} min ...`);
    await sleep(Math.round(SPACING_MIN * 60 * 1000));
  }
}
log(`done — ${count} uploaded this run, ${doneSet.size}/${items.length} total.`);
process.exit(0);
