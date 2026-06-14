// Quick sanity check: can we attach to your Chrome, and are you signed into
// YouTube Studio? Run this once after the "One-time setup" in the README.
//   node src/connect-check.mjs
import { connectCDP, sleep } from './browser.mjs';

const { context } = await connectCDP();
const page = await context.newPage();
try {
  await page.goto('https://studio.youtube.com/', { waitUntil: 'domcontentloaded' });
  await sleep(5000);
  const url = page.url();
  const signedOut = /accounts\.google\.com|\/signin/i.test(url);
  console.log(JSON.stringify({
    attached: true,
    onStudio: /studio\.youtube\.com/.test(url),
    signedOut,
    hint: signedOut
      ? 'Sign into YouTube once in the Chrome window you launched, then re-run.'
      : 'Looks good — you are attached and signed in.',
  }, null, 2));
} finally {
  await page.close().catch(() => {});
  process.exit(0);
}
