/**
 * Unauthenticated body-parse failures are client errors (400 / 413 problem+json),
 * not 500 internal-error, and they are logged at warn without a stack.
 *
 * Covers the three cases from the six-area R&T P2 on 88a72e6: malformed JSON,
 * a `__proto__` key, and a body above the 1 MB framework limit.
 */
import assert from 'node:assert/strict';
import { test } from 'node:test';
import { startHarness, type Harness } from '../../apps/api/dist/testing/harness.js';

const URL = '/api/management-web/v0/strata/charges/chg_wfg_a1_202609/invoice-email';
const CONTENT_TYPE = { 'content-type': 'application/json' };

const INVALID_REQUEST = 'https://pemo.local/problems/invalid-request';
const REFUSED = 'https://pemo.local/problems/refused';
const TOO_LARGE = 'https://pemo.local/problems/request-too-large';

interface ProblemBody {
  type: string;
  status: number;
  title: string;
}

interface LogLine {
  level: string;
  message: string;
  fields: Record<string, unknown>;
}

type LogFn = (message: string, fields?: Record<string, unknown>) => void;

const installLogProbe = (harness: Harness): LogLine[] => {
  const lines: LogLine[] = [];
  const log = harness.modules.log as { warn: LogFn; error: LogFn };
  const wrap = (level: 'warn' | 'error', original: LogFn): LogFn =>
    (message, fields) => {
      lines.push({ level, message, fields: { ...(fields ?? {}) } });
      original.call(log, message, fields);
    };
  log.warn = wrap('warn', log.warn.bind(log));
  log.error = wrap('error', log.error.bind(log));
  return lines;
};

const assertProblem = (res: { statusCode: number; headers: Record<string, unknown>; body: string }, status: number, type: string, label: string): ProblemBody => {
  assert.notEqual(res.statusCode, 500, `${label} must not be 500: ${res.body}`);
  assert.equal(res.statusCode, status, `${label} -> ${res.statusCode} ${res.body}`);
  assert.match(String(res.headers['content-type'] ?? ''), /application\/problem\+json/);
  const body = JSON.parse(res.body) as ProblemBody;
  assert.equal(body.status, status, `${label} body.status`);
  assert.equal(body.type, type, `${label} body.type`);
  return body;
};

test('unauthenticated malformed JSON, __proto__ key, and oversized body map to 400/413 problem+json, not 500', async () => {
  const harness: Harness = await startHarness();
  const logs = installLogProbe(harness);
  try {
    const malformed = await harness.app.inject({
      method: 'POST',
      url: URL,
      headers: CONTENT_TYPE,
      payload: '{"not',
    });
    assertProblem(malformed, 400, INVALID_REQUEST, 'malformed JSON');

    const proto = await harness.app.inject({
      method: 'POST',
      url: URL,
      headers: CONTENT_TYPE,
      payload: '{"__proto__":{"admin":true}}',
    });
    assertProblem(proto, 400, REFUSED, '__proto__ key');

    const oversized = await harness.app.inject({
      method: 'POST',
      url: URL,
      headers: CONTENT_TYPE,
      payload: `{"pad":"${'a'.repeat(1.5 * 1024 * 1024)}"}`,
    });
    assertProblem(oversized, 413, TOO_LARGE, 'body > 1 MB');

    const emptyValid = await harness.app.inject({
      method: 'POST',
      url: URL,
      headers: CONTENT_TYPE,
      payload: '{}',
    });
    assert.equal(emptyValid.statusCode, 401, `valid empty body should still be 401, got ${emptyValid.statusCode} ${emptyValid.body}`);
    const emptyBody = JSON.parse(emptyValid.body) as ProblemBody;
    assert.equal(emptyBody.type, 'https://pemo.local/problems/invalid-credential');

    const unexpectedErrors = logs.filter((line) => line.level === 'error');
    assert.deepEqual(
      unexpectedErrors.map((line) => line.message),
      [],
      `error-level logs must not fire: ${JSON.stringify(unexpectedErrors)}`,
    );
    const stacks = logs.filter((line) => Object.prototype.hasOwnProperty.call(line.fields, 'stack'));
    assert.deepEqual(
      stacks.map((line) => ({ message: line.message, stack: line.fields.stack })),
      [],
      'body-parse logs must not include a stack field',
    );
    const kinds = logs
      .filter((line) => line.level === 'warn')
      .map((line) => line.fields.kind)
      .filter((kind) => kind === 'malformed' || kind === 'refused' || kind === 'too-large');
    assert.deepEqual(kinds.sort(), ['malformed', 'refused', 'too-large']);
  } finally {
    await harness.close();
  }
});
