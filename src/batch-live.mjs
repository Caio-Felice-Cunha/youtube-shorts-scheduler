// LIVE MODE: uploads/schedules every entry through an attached Chrome.
import fs from 'node:fs';
import { runBatch } from './batch-core.mjs';
import { connectCDP, parseArgs, sleep } from './browser.mjs';
import { config, resolveVideoPath } from './config.mjs';
import { uploadVideo } from './upload.mjs';

const args = parseArgs(process.argv);
const manifestPath = args.manifest || 'manifest.json';
const statePath = args.state || '.posted.json';
const spacingMinutes = args.spacing ? Number(args.spacing) : config.batchSpacingMinutes;
const log = (...messages) => console.log(`[${new Date().toISOString().slice(11, 19)}]`, ...messages);

if (!fs.existsSync(manifestPath)) {
  console.error(`manifest not found: ${manifestPath} (copy manifest.example.json to manifest.json and edit it)`);
  process.exit(2);
}
const items = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
const prior = fs.existsSync(statePath) ? (JSON.parse(fs.readFileSync(statePath, 'utf8')).done || []) : [];
const { context } = await connectCDP();
log(`${items.length} entries; ${prior.length} already done; ${spacingMinutes} min between uploads`);

const result = await runBatch({
  items, done: prior,
  adapter: { process: (item) => uploadVideo(context, { ...item, file: resolveVideoPath(item.file) }) },
  spacingMs: Math.round(spacingMinutes * 60 * 1000), wait: sleep,
  onEvent(event) {
    const position = `${event.index + 1}/${items.length}`;
    if (event.type === 'started') log(`[${position}] uploading: ${event.key}`);
    if (event.type === 'skipped') log(`[${position}] skip (done): ${event.key}`);
    if (event.type === 'completed') {
      fs.writeFileSync(statePath, JSON.stringify({ done: event.done, updated: new Date().toISOString() }, null, 2));
      log(`OK ${event.key} - ${event.done.length}/${items.length} total`);
    }
    if (event.type === 'waiting') log(`waiting ${spacingMinutes} min ...`);
    if (event.type === 'failed') log(`FAILED ${event.key}: ${event.error}. Stopping; re-run to resume.`);
  },
});
log(`done - ${result.processed} uploaded this run, ${result.done.length}/${items.length} total.`);
process.exit(result.ok ? 0 : 1);

