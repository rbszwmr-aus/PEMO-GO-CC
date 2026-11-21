/**
 * No runtime analytics, crash reporting or attribution SDK.
 *
 * A standing project rule, not a PID restriction. Stated once in a manifest it
 * is a claim; asserted here it stays true as the dependency set grows — and the
 * dependency count is a number that only goes up.
 */

import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT } from '../../tool/corpus-source.ts';

const manifest = JSON.parse(readFileSync(join(APP_ROOT, 'package.json'), 'utf8'));

/** Everything permitted to reach a browser. Adding to this list is a decision. */
const RUNTIME_ALLOWLIST = new Set(['react', 'react-dom']);

const FORBIDDEN_SUBSTRINGS = [
  'analytics', 'telemetry', 'sentry', 'bugsnag', 'rollbar', 'datadog', 'newrelic',
  'appsflyer', 'adjust', 'branch-sdk', 'amplitude', 'mixpanel', 'segment',
  'firebase', 'crashlytics', 'gtag', 'google-analytics', 'hotjar', 'fullstory',
  'logrocket', 'posthog', 'heap-analytics', 'matomo', 'plausible', 'clarity',
];

test('the runtime dependency set is exactly the allowlist', () => {
  const runtime = Object.keys(manifest.dependencies ?? {});
  assert.deepEqual(
    runtime.slice().sort(),
    [...RUNTIME_ALLOWLIST].sort(),
    'a runtime dependency was added without a decision. The browser payload is react, react-dom and scheduler.',
  );
});

test('no analytics, crash reporting or attribution package appears anywhere', () => {
  const all = [
    ...Object.keys(manifest.dependencies ?? {}),
    ...Object.keys(manifest.devDependencies ?? {}),
  ];
  const found: string[] = [];
  for (const dep of all) {
    for (const bad of FORBIDDEN_SUBSTRINGS) {
      if (dep.toLowerCase().includes(bad)) found.push(`${dep} matches "${bad}"`);
    }
  }
  assert.deepEqual(found, [], `forbidden SDK present:\n  ${found.join('\n  ')}`);
});

test('the check is not vacuous — it would catch a real SDK name', () => {
  const wouldCatch = (name: string) =>
    FORBIDDEN_SUBSTRINGS.some((bad) => name.toLowerCase().includes(bad));
  assert.ok(wouldCatch('@sentry/react'), 'the substring check does not catch @sentry/react');
  assert.ok(wouldCatch('firebase'), 'the substring check does not catch firebase');
  assert.ok(!wouldCatch('react-dom'), 'the substring check false-positives on react-dom');
});

test('the manifest still declares the no-analytics rule in prose', () => {
  assert.match(manifest['//no-analytics'] ?? '', /analytics/i);
});
