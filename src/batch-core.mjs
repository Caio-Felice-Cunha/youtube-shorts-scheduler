export async function runBatch({ items, done = [], adapter, keyOf = (item) => item.file, spacingMs = 0, wait = (ms) => new Promise((resolve) => setTimeout(resolve, ms)), onEvent = () => {} }) {
  if (!Array.isArray(items)) throw new TypeError('items must be an array');
  if (!adapter || typeof adapter.process !== 'function') throw new TypeError('adapter.process must be a function');
  const doneSet = new Set(done);
  const results = [];
  let processed = 0;
  for (let index = 0; index < items.length; index += 1) {
    const item = items[index];
    const key = keyOf(item);
    if (!key) throw new Error(`item ${index + 1} has no stable key`);
    if (doneSet.has(key)) {
      results.push({ key, status: 'skipped', steps: [] });
      onEvent({ type: 'skipped', index, item, key, done: [...doneSet] });
      continue;
    }
    onEvent({ type: 'started', index, item, key, done: [...doneSet] });
    try {
      const result = await adapter.process(item, { index, total: items.length });
      if (!result?.ok) throw new Error('adapter did not complete');
      doneSet.add(key);
      processed += 1;
      const entry = { key, status: 'simulated', ...result };
      results.push(entry);
      onEvent({ type: 'completed', index, item, key, result: entry, done: [...doneSet] });
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      results.push({ key, status: 'failed', error: message, steps: [] });
      onEvent({ type: 'failed', index, item, key, error: message, done: [...doneSet] });
      return { ok: false, processed, done: [...doneSet], results, error: message };
    }
    const hasPending = items.slice(index + 1).some((candidate) => !doneSet.has(keyOf(candidate)));
    if (hasPending && spacingMs > 0) {
      onEvent({ type: 'waiting', index, milliseconds: spacingMs, done: [...doneSet] });
      await wait(spacingMs);
    }
  }
  return { ok: true, processed, done: [...doneSet], results };
}
