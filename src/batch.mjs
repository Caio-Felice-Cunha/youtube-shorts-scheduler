// Safe dispatcher: the demo path never loads the live Playwright/CDP graph.
const demoMode = process.argv.slice(2).includes('--demo');
if (demoMode) {
  const { runDemo } = await import('./demo.mjs');
  const value = (name) => {
    const index = process.argv.indexOf(`--${name}`);
    return index >= 0 ? process.argv[index + 1] : undefined;
  };
  const { report, reportPath } = await runDemo({ fixture: value('fixture'), output: value('output') });
  console.log(`Offline demo complete: ${report.summary.simulated}/${report.summary.total} simulated.`);
  console.log(`Report written -> ${reportPath}`);
} else {
  await import('./batch-live.mjs');
}

