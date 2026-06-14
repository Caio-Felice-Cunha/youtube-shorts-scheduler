// Minimal config loader: reads environment variables, with an optional .env
// file (no dependency). Copy .env.example to .env and edit it.
import fs from 'node:fs';
import path from 'node:path';

function loadDotEnv(file) {
  if (!fs.existsSync(file)) return;
  for (const raw of fs.readFileSync(file, 'utf8').split('\n')) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
    if (!m) continue;
    const key = m[1];
    if (key in process.env) continue; // real env wins over .env file
    process.env[key] = m[2].replace(/^["']|["']$/g, '');
  }
}

loadDotEnv(path.resolve(process.cwd(), '.env'));

const port = process.env.DEBUG_PORT || '9222';

export const config = {
  debugPort: port,
  cdpUrl: process.env.CDP_URL || `http://localhost:${port}`,
  videosDir: process.env.VIDEOS_DIR || 'videos',
  batchSpacingMinutes: Number(process.env.BATCH_SPACING_MINUTES || 2),
};

// Resolve a manifest entry's "file" against VIDEOS_DIR (absolute paths pass through).
export function resolveVideoPath(file) {
  return path.isAbsolute(file) ? file : path.resolve(config.videosDir, file);
}
