import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { runBatch } from './batch-core.mjs';
import { createYouTubeDemoAdapter } from './demo-adapter.mjs';

function parseArgs(argv) {
  const args = {};
  for (let index = 2; index < argv.length; index += 1) {
    if (!argv[index].startsWith('--')) continue;
    const key = argv[index].slice(2);
    const next = argv[index + 1];
    args[key] = next && !next.startsWith('--') ? next : true;
  }
  return args;
}

export async function runDemo({ fixture, output } = {}) {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const fixturePath = path.resolve(fixture || path.join(root, 'manifest.example.json'));
  const outputDir = path.resolve(output || path.join(root, 'site'));
  const items = JSON.parse(fs.readFileSync(fixturePath, 'utf8'));
  const batch = await runBatch({ items, adapter: createYouTubeDemoAdapter() });
  const report = {
    schemaVersion: 1, tool: 'YouTube Shorts Scheduler', mode: 'demo', fixture: path.basename(fixturePath),
    generatedAt: '2026-08-29T12:00:00.000Z', items: batch.results,
    summary: { total: items.length, simulated: batch.results.filter((item) => item.status === 'simulated').length, failed: batch.results.filter((item) => item.status === 'failed').length, externalWrites: 0 },
  };
  fs.mkdirSync(outputDir, { recursive: true });
  const reportPath = path.join(outputDir, 'demo-report.json');
  fs.writeFileSync(reportPath, `${JSON.stringify(report, null, 2)}\n`);
  return { report, reportPath };
}

if (process.argv[1] && path.basename(process.argv[1]) === 'demo.mjs') {
  const args = parseArgs(process.argv);
  const { report, reportPath } = await runDemo({ fixture: args.fixture, output: args.output });
  console.log(`Offline demo complete: ${report.summary.simulated}/${report.summary.total} simulated.`);
  console.log(`Report written -> ${reportPath}`);
}
