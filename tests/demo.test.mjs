import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { execFileSync } from 'node:child_process';
import { runBatch } from '../src/batch-core.mjs';
import { runDemo } from '../src/demo.mjs';

test('pure batch engine delegates work and records completion', async () => {
  const result = await runBatch({ items: [{ file: 'one.mp4' }, { file: 'two.mp4' }], adapter: { process: async (item) => ({ ok: true, label: item.file, steps: [] }) } });
  assert.equal(result.ok, true);
  assert.deepEqual(result.done, ['one.mp4', 'two.mp4']);
});

test('offline demo writes the common zero-write report', async () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-demo-'));
  const { report, reportPath } = await runDemo({ output });
  assert.equal(report.mode, 'demo');
  assert.equal(report.summary.externalWrites, 0);
  assert.equal(report.summary.simulated, 3);
  assert.equal(fs.existsSync(reportPath), true);
});

test('demo dependency graph does not import browser or upload modules', () => {
  const source = fs.readFileSync(new URL('../src/demo.mjs', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /browser\.mjs|upload\.mjs|playwright|connectCDP/);
});

test('batch --demo dispatches without loading live mode', () => {
  const output = fs.mkdtempSync(path.join(os.tmpdir(), 'yt-batch-demo-'));
  const stdout = execFileSync(process.execPath, ['src/batch.mjs', '--demo', '--output', output], { cwd: path.resolve('.'), encoding: 'utf8' });
  assert.match(stdout, /3\/3 simulated/);
  assert.equal(fs.existsSync(path.join(output, 'demo-report.json')), true);
});
