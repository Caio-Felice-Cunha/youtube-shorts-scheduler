// Attach to a Chrome you launched yourself with --remote-debugging-port.
//
// We ATTACH (connectOverCDP) instead of launching the browser with Playwright on
// purpose: a Playwright-launched browser sets navigator.webdriver, which Google
// detects and rejects. Attaching to a normally-launched Chrome keeps a clean
// fingerprint, so your existing logged-in session stays valid.
import { chromium } from 'playwright-core';
import { config } from './config.mjs';

export async function connectCDP() {
  let browser;
  try {
    browser = await chromium.connectOverCDP(config.cdpUrl);
  } catch (err) {
    throw new Error(
      `Could not attach to Chrome at ${config.cdpUrl}.\n` +
      `Launch Chrome first with --remote-debugging-port (see README "One-time setup").\n` +
      `Original error: ${(err && err.message) || err}`,
    );
  }
  const context = browser.contexts()[0];
  if (!context) {
    throw new Error(
      'Attached to Chrome but found no browser context. Launch Chrome with an explicit ' +
      '--profile-directory so it opens a real profile (not the profile picker).',
    );
  }
  return { browser, context };
}

// CLI-arg helper shared by the scripts: --flag value / --flag (boolean).
export function parseArgs(argv) {
  const out = {};
  const a = argv.slice(2);
  for (let i = 0; i < a.length; i += 1) {
    if (!a[i].startsWith('--')) continue;
    const key = a[i].slice(2);
    const next = a[i + 1];
    out[key] = next && !next.startsWith('--') ? next : true;
  }
  return out;
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
