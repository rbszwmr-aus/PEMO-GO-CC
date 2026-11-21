import assert from 'node:assert/strict';
import { test } from 'node:test';
import { createCancellableLoader } from '../../src/data/live-scope-load.ts';

test('R5 — a stale in-flight response cannot restore the previous scope', async () => {
  const loader = createCancellableLoader<string>();
  let resolveA: (value: string) => void = () => {};
  const first = loader.load(
    (signal) =>
      new Promise<string>((resolve, reject) => {
        signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
        resolveA = resolve;
      }),
  );

  const second = loader.load(async () => 'estate-B');
  assert.equal(await second, 'estate-B');

  resolveA('estate-A');
  await assert.rejects(first, (err: unknown) => err instanceof Error && err.name === 'AbortError');
});
