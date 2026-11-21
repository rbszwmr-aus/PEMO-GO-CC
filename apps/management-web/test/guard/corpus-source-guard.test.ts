/**
 * The fixture-source guard, and the proof that it fires.
 *
 * UI-011-ST's lesson: a suite of negative tests cannot detect its own
 * disconnection, because disconnection looks exactly like failure. On this
 * surface the equivalent is that ABSENT DATA LOOKS EXACTLY LIKE THE EMPTY
 * STATE — and this app renders empty, loading and error states on every screen.
 *
 * A guard that has never been seen to fire is an assumption. These tests stub
 * the source three ways and require it to fail each time, including the case a
 * schema-only check would survive: a hollow stub that is structurally valid and
 * carries no authored content.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';

import { APP_ROOT, loadCorpus } from '../../tool/corpus-source.ts';
import { buildCorpusTs } from '../../tool/generate-corpus.ts';
import { readFileSync } from 'node:fs';

/** Load the corpus in a child process with the source repointed. Returns stderr+stdout. */
function loadWith(dir: string): { ok: boolean; output: string } {
  try {
    const out = execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '-e',
        "import('./tool/corpus-source.ts').then(m=>{m.loadCorpus();console.log('LOADED');}).catch(e=>{console.log(e.message);process.exit(3);})",
      ],
      { cwd: APP_ROOT, env: { ...process.env, PEMO_MGMT_FIXTURE_DIR: dir }, encoding: 'utf8' },
    );
    return { ok: out.includes('LOADED'), output: out };
  } catch (e: any) {
    return { ok: false, output: String(e.stdout ?? '') + String(e.stderr ?? '') };
  }
}

test('the guard fires when the fixture source does not exist', () => {
  const { ok, output } = loadWith(join(tmpdir(), 'pemo-no-such-corpus-dir'));
  assert.equal(ok, false, 'the corpus loaded from a nonexistent directory');
  assert.match(output, /PEMO FIXTURE SOURCE GUARD FAILED/);
  assert.match(output, /corpus directory does not exist/);
});

test('the guard fires when the fixture source is an empty directory', () => {
  const dir = mkdtempSync(join(tmpdir(), 'pemo-empty-corpus-'));
  try {
    const { ok, output } = loadWith(dir);
    assert.equal(ok, false, 'the corpus loaded from an empty directory');
    assert.match(output, /PEMO FIXTURE SOURCE GUARD FAILED/);
    assert.match(output, /manifest is missing/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the guard fires on a HOLLOW stub — valid manifest, valid schema, no authored content', () => {
  // This is the case that matters. A schema-only check passes here: the manifest
  // is well formed, the fixture parses, and `events: []` is a legitimate empty
  // response. Only a positive assertion on authored content can tell it apart
  // from the real corpus rendering its empty state.
  const dir = mkdtempSync(join(tmpdir(), 'pemo-hollow-corpus-'));
  try {
    mkdirSync(join(dir, 'mob-s1-safety'), { recursive: true });
    writeFileSync(
      join(dir, 'index.json'),
      JSON.stringify({
        contractVersion: '0.1.0',
        surface: 'management',
        pid: 'API-017-ST',
        fixtures: [
          {
            file: 'mob-s1-safety/default.json',
            screen: 'mob-s1-safety',
            state: 'default',
            schema: 'SafetyEventListResponse',
          },
        ],
      }),
    );
    writeFileSync(
      join(dir, 'mob-s1-safety/default.json'),
      JSON.stringify({
        meta: { correlationId: 'x', contractVersion: '0.1.0', generatedAt: '2026-08-12T09:56:00+08:00' },
        window: { hours: 24, returned: 0, total: 0, retentionMonths: 24 },
        events: [],
      }),
    );
    const { ok, output } = loadWith(dir);
    assert.equal(ok, false, 'a hollow stub loaded — the positive assertion is not load-bearing');
    assert.match(output, /the positive assertion did not hold/);
    assert.match(output, /HS-2026-08-12-004417/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('the guard fires when pointed at the RESIDENT corpus rather than the management one', () => {
  // Not a hypothetical: both corpora sit under tests/fixtures/ and differ by one
  // path segment. Rendering resident fixtures on a staff surface would produce
  // plausible, wrong screens rather than an obvious failure.
  const { ok, output } = loadWith(join(APP_ROOT, '../../tests/fixtures/resident-mobile'));
  assert.equal(ok, false, 'the resident corpus was accepted by the management surface');
  assert.match(output, /the corpus is not the management surface/);
});

test('the guard accepts the genuine corpus, and the positive assertions hold', () => {
  const c = loadCorpus();
  assert.equal(c.manifest.surface, 'management');
  // Asserted as a RELATIONSHIP, not a literal count.
  //
  // These were pinned at 22 and 12 and broke the moment API-020-ST added four
  // fixtures — noise on every corpus addition, which is the change class this
  // corpus is going to keep seeing. What the check is actually for is that
  // every DECLARED fixture loaded, so that is what it now says. The floor keeps
  // it non-vacuous: a corpus that shrank to nothing would satisfy the equality.
  const declaredFiles = c.manifest.fixtures.filter((f) => f.file).length;
  const declaredClientOnly = c.manifest.fixtures.filter((f) => !f.file).length;
  assert.equal(c.files.size, declaredFiles, 'a fixture declared in index.json did not load');
  assert.equal(c.clientOnly.length, declaredClientOnly, 'a client-only declaration was dropped');
  assert.ok(c.files.size >= 20, `only ${c.files.size} fixtures loaded; the corpus is not the real one`);

  const s1 = c.files.get('mob-s1-safety/default.json') as any;
  const smoke = s1.events.find((e: any) => e.reference === 'HS-2026-08-12-004417');
  assert.ok(smoke, 'the authored event is present');
  assert.equal(smoke.title['zh-Hant'], '單位偵測到煙霧');
});

test('src/data/corpus.g.ts is not stale', () => {
  const onDisk = readFileSync(join(APP_ROOT, 'src/data/corpus.g.ts'), 'utf8');
  assert.equal(
    onDisk,
    buildCorpusTs(),
    'src/data/corpus.g.ts differs from the corpus it claims to embed. Run `pnpm run generate`.',
  );
});

test('the browser-side guard fires when the embedded corpus is tampered with', () => {
  // Generation and rendering are different machines. The node guard proves the
  // disk was genuine; this proves what reached the browser still is.
  const gen = readFileSync(join(APP_ROOT, 'src/data/corpus.g.ts'), 'utf8');
  const tampered = gen.replace('HS-2026-08-12-004417', 'HS-0000-00-00-000000');
  assert.notEqual(tampered, gen, 'the reference to tamper with was not found');

  const dir = mkdtempSync(join(tmpdir(), 'pemo-tampered-corpus-'));
  try {
    const f = join(dir, 'corpus.g.ts');
    writeFileSync(f, tampered);
    let threw: string | undefined;
    try {
      execFileSync(
        process.execPath,
        ['--experimental-strip-types', '-e', `import(${JSON.stringify(f)}).then(m=>{m.assertCorpusIsGenuine();console.log('PASSED');})`],
        { encoding: 'utf8', stdio: 'pipe' },
      );
    } catch (e: any) {
      threw = String(e.stdout ?? '') + String(e.stderr ?? '');
    }
    assert.ok(threw, 'the browser-side guard did not fire on a tampered corpus');
    assert.match(threw, /PEMO FIXTURE SOURCE GUARD \(browser\) FAILED/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test('skipDigestCheck relaxes ONLY the digest — it cannot bless a hollow corpus', () => {
  // The narrow hole, pinned. write-digest.ts needs to run against a corpus whose
  // digest no longer matches — that is the whole point of re-recording — so it
  // passes skipDigestCheck. If that option ever also skipped the positive
  // assertions, `pnpm run digest` would become a way to launder a stubbed
  // corpus into a recorded one, and every downstream guard would trust it.
  //
  // Found by a re-pin dry run: the recorder could not run at all, because it
  // was blocked by the very mismatch it exists to resolve.
  const hollow = mkdtempSync(join(tmpdir(), 'pemo-hollow-digest-'));
  try {
    mkdirSync(join(hollow, 'mob-s1-safety'), { recursive: true });
    writeFileSync(
      join(hollow, 'index.json'),
      JSON.stringify({
        contractVersion: '0.1.0',
        surface: 'management',
        pid: 'API-017-ST',
        fixtures: [{ file: 'mob-s1-safety/default.json', screen: 'mob-s1-safety', state: 'default', schema: 'SafetyEventListResponse' }],
      }),
    );
    writeFileSync(
      join(hollow, 'mob-s1-safety/default.json'),
      JSON.stringify({ meta: { correlationId: 'x', contractVersion: '0.1.0', generatedAt: '2026-08-12T09:56:00+08:00' }, window: { hours: 24, returned: 0, total: 0, retentionMonths: 24 }, events: [] }),
    );

    const out = execFileSync(
      process.execPath,
      [
        '--experimental-strip-types',
        '-e',
        "import('./tool/corpus-source.ts').then(m=>{m.loadCorpus({skipDigestCheck:true});console.log('BLESSED');}).catch(e=>{console.log(e.message);})",
      ],
      { cwd: APP_ROOT, env: { ...process.env, PEMO_MGMT_FIXTURE_DIR: hollow }, encoding: 'utf8' },
    );

    assert.ok(!out.includes('BLESSED'), 'skipDigestCheck accepted a hollow corpus; the hole is no longer narrow');
    assert.match(out, /the positive assertion did not hold/);
  } finally {
    rmSync(hollow, { recursive: true, force: true });
  }
});
