/**
 * F-2: an unconfigured communications port is 503 problem+json, not a 500.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';
import { createUnconfiguredCommunicationsPort } from '../../apps/api/dist/communications/index.js';

test('unconfigured communications port returns 503 problem+json on invoice email, notice email, and notice delivery (F-2)', async () => {
  const harness: Harness = await startHarness();
  try {
    (harness.modules as { communications: ReturnType<typeof createUnconfiguredCommunicationsPort> })
      .communications = createUnconfiguredCommunicationsPort();
    const headers = {
      authorization: `Bearer ${harness.modules.staffAuth.issue('stf_wfg_manager')}`,
    };

    const paths = [
      { method: 'POST', url: '/api/management-web/v0/strata/charges/chg_wfg_a1_202609/invoice-email' },
      { method: 'POST', url: '/api/management-web/v0/notices/ntc_seed_lift/email' },
      { method: 'GET', url: '/api/management-web/v0/notices/ntc_seed_lift/delivery' },
    ] as const;

    for (const path of paths) {
      const res = await harness.app.inject({ method: path.method, url: path.url, headers });
      assert.equal(res.statusCode, 503, `${path.method} ${path.url} -> ${res.statusCode} ${res.body}`);
      assert.match(String(res.headers['content-type'] ?? ''), /application\/problem\+json/);
      const body = JSON.parse(res.body) as {
        type: string; status: number; title: string; retryable: boolean;
      };
      assert.equal(body.status, 503);
      assert.equal(body.type, 'https://pemo.local/problems/communications-unavailable');
      assert.equal(body.retryable, true);
    }
  } finally {
    await harness.close();
  }
});
