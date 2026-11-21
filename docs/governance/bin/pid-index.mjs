#!/usr/bin/env node
/**
 * PID register generator — the index, the next number, and the alarms.
 *
 * ONE directory scan feeds everything. `scan()` runs exactly once per
 * invocation and every output below is derived from its single record set,
 * so the index, `max(NNN)+1` and the duplicate check can never disagree with
 * each other about what the directory contains.
 *
 *   node docs/governance/bin/pid-index.mjs            regenerate the two index files
 *   node docs/governance/bin/pid-index.mjs --check    verify only; writes nothing
 *   node docs/governance/bin/pid-index.mjs --next     print max(NNN)+1
 *
 * EXIT CODES ARE DISTINCT PER FAULT, deliberately. A single exit 1 for four
 * different faults makes "it failed" uninformative, and every acceptance line
 * this tool backs has to be shown firing FOR ITS OWN REASON.
 *
 *   0  all checks pass
 *   1  duplicate NNN            — the two-files alarm
 *   2  front-matter schema violation
 *   3  index drift (--check)    — regenerated output != committed file
 *   4  a PID file is invisible to git
 *   5  orphan report            — a number in reports/ held by no PID file
 *   6  closed PID with no filed ruling
 *   7  a commit since the register landed carries no [PID-ID] tag
 *
 * ZERO DEPENDENCIES, and no git required for the core checks. A governance tool
 * that cannot run before `pnpm install`, or that dies outside a git checkout, is
 * the defect DOC-002 recorded as F3: tests that shell out to git are un-runnable
 * from an export or a container. Checks 1, 2, 3 and 5 run anywhere. Check 4 needs
 * git and SAYS SO OUT LOUD when it cannot run — a silent skip reads as a pass
 * (DOC-002 F7), so `--require-git` makes its absence fatal for CI.
 */

import { readdirSync, readFileSync, writeFileSync, existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(HERE, '..');
/**
 * The REPOSITORY root, not the governance root. The commit-trail checks below
 * use pathspecs like ':(exclude)docs/governance', which git resolves relative to
 * the process cwd — so running them from ROOT would make '.' mean docs/governance
 * and the exclusion miss entirely. Caught by the guard warning on its own PID's
 * allocation commit: a 100%-false-positive first draft, which is the cry-wolf
 * failure the principle names.
 */
const REPO_ROOT = path.resolve(ROOT, '..', '..');
const DIRS = { pids: path.join(ROOT, 'pids'), archive: path.join(ROOT, 'archive'), reports: path.join(ROOT, 'reports') };
const INDEX = path.join(ROOT, 'PID-INDEX.md');
const ARCHIVE_INDEX = path.join(DIRS.archive, 'PID-INDEX-ARCHIVE.md');

const TYPES = ['API', 'GEN', 'UI', 'DOC'];
/**
 * `superseded` (GEN-046 G7) is the fourth way a PID ends, and it existed in
 * practice long before the register could say it. UI-004's requests were answered
 * by ADR-019 and its screens rebuilt by UI-045; the UI track closed it as `done`
 * because that was the only closed status available, and said so — correct
 * restraint, and the register's gap rather than the executor's. A status enum
 * that cannot express an outcome does not prevent the outcome; it just stops the
 * record from being true.
 */
const STATUSES = ['draft', 'running', 'done', 'merged', 'superseded'];
const CLOSED_STATUSES = ['done', 'merged', 'superseded'];
const REQUIRED = ['id', 'type', 'version', 'from', 'to', 'status', 'pin', 'write_scope'];
/**
 * The COMPLETE set of keys a PID may carry. Anything else is an error, never
 * ignored: `reports:` was removed from the schema because its glob drifted from
 * the directory uniformly across every PID that had one, and a tolerated
 * leftover would go on declaring something no longer true. No safe default.
 */
/**
 * `ruling:` (GEN-046 G7) names this PID's filed `-RULINGS-` report EXPLICITLY.
 *
 * Every other report is derived from the `<ID>-` prefix, which is right for the
 * ordinary case and wrong for exactly one: a PID whose ruling was filed under
 * ANOTHER PID's number. UI-004 is closed by
 * `UI-045-RULINGS-step1-notices-part1.md`, and no prefix scan can ever see that
 * — so the close check would refuse a true record, and the derived report list
 * would omit the only document that explains the close.
 *
 * This is a CROSS-REFERENCE, not a return of the deleted `reports:` glob. That
 * key listed what could be derived and drifted from it; this names the one thing
 * that cannot be derived, and is VERIFIED against the directory: the file must
 * exist in reports/ and must carry `-RULINGS-` in its name.
 */
const ALLOWED = [...REQUIRED, 'closed', 'ruling', 'note'];
const ID_RE = new RegExp(`^(${TYPES.join('|')})-(\\d{3})$`);
/** Any PID-shaped token. ADR- carries its own sequence and is excluded by rule 1. */
const TOKEN_RE = new RegExp(`\\b(${TYPES.join('|')})-(\\d{3})\\b`);

const faults = [];
const fault = (code, msg) => faults.push({ code, msg });
const notes = [];

/* ─── front-matter ───────────────────────────────────────────────────────────
 * A deliberately narrow subset: `---` on line 1, one `key: value` per line,
 * value = everything after the FIRST colon. No multi-line values, no nesting,
 * no lists, no comments, no duplicate keys. Anything else is a LOUD failure
 * rather than a best-effort parse — a schema too small to express the ambiguous
 * case cannot silently mis-parse it. Values legitimately contain ':', '`', '—',
 * '→', '<', '>' and parentheses, and splitting on the first colon handles all.
 */
export function parseFrontMatter(text, label) {
  const lines = text.split('\n');
  if (lines[0] !== '---') { fault(2, `${label}: no front-matter (line 1 is not '---')`); return null; }
  const end = lines.indexOf('---', 1);
  if (end === -1) { fault(2, `${label}: front-matter is not closed by '---'`); return null; }
  const fm = {};
  for (let i = 1; i < end; i++) {
    const line = lines[i];
    if (line.trim() === '') continue;
    const c = line.indexOf(':');
    if (c === -1) { fault(2, `${label}: line ${i + 1} is not 'key: value' — ${JSON.stringify(line)}`); continue; }
    const key = line.slice(0, c).trim();
    const value = line.slice(c + 1).trim();
    if (!/^[a-z_]+$/.test(key)) { fault(2, `${label}: line ${i + 1} has a malformed key ${JSON.stringify(key)}`); continue; }
    if (key in fm) { fault(2, `${label}: duplicate key '${key}' on line ${i + 1}`); continue; }
    if (/\s#\s/.test(value)) {
      // The template carries explanatory '# ...' comments. Copying it literally
      // leaves them in a real PID, so name that cause instead of truncating.
      fault(2, `${label}: value for '${key}' contains ' # ' — if this was copied from PID-TEMPLATE.md, delete the explanatory comment (comments are not part of the accepted subset)`);
      continue;
    }
    fm[key] = value;
  }
  const h1 = text.slice(text.indexOf('\n', end) + 1).match(/^# (\S+) — (.+)$/m);
  return { fm, h1Id: h1 ? h1[1] : null, title: h1 ? h1[2].trim() : null };
}

function validate(rec) {
  const { fm, path: p, dir, stem, h1Id, title } = rec;
  const L = path.relative(ROOT, p);
  for (const k of REQUIRED) if (!(k in fm)) fault(2, `${L}: missing required key '${k}'`);
  for (const k of Object.keys(fm)) {
    if (ALLOWED.includes(k)) continue;
    const why = k === 'reports'
      ? " — 'reports:' was removed from the schema; a PID's report list is derived from the reports/ directory by <ID>- prefix"
      : ` — the schema is exactly: ${ALLOWED.join(', ')}`;
    fault(2, `${L}: unknown key '${k}'${why}`);
  }
  if (fm.id && !ID_RE.test(fm.id)) fault(2, `${L}: id '${fm.id}' is not <TYPE>-NNN with TYPE in ${TYPES.join('|')}`);
  if (fm.id && fm.id !== stem) fault(2, `${L}: id '${fm.id}' != filename stem '${stem}'`);
  if (fm.id && h1Id && fm.id !== h1Id) fault(2, `${L}: id '${fm.id}' != H1 id '${h1Id}'`);
  if (!title) fault(2, `${L}: no '# <ID> — <title>' heading (the index title column has no source)`);
  if (fm.type && !TYPES.includes(fm.type)) fault(2, `${L}: type '${fm.type}' not in ${TYPES.join('|')}`);
  if (fm.id && fm.type && ID_RE.test(fm.id) && fm.id.split('-')[0] !== fm.type) fault(2, `${L}: type '${fm.type}' != id prefix '${fm.id.split('-')[0]}'`);
  if (fm.version && !/^v\d+\.\d+$/.test(fm.version)) fault(2, `${L}: version '${fm.version}' is not vN.N`);
  if (fm.status && !STATUSES.includes(fm.status)) fault(2, `${L}: status '${fm.status}' not in ${STATUSES.join('|')}`);
  for (const k of ['from', 'to', 'pin', 'write_scope']) if (k in fm && fm[k] === '') fault(2, `${L}: '${k}' is empty`);

  const closedState = CLOSED_STATUSES.includes(fm.status);
  const closed = fm.closed ?? '';
  if (closedState) {
    if (!closed) fault(2, `${L}: status '${fm.status}' requires a 'closed: YYYY-MM-DD' date — the archive index generates that column from it`);
    else if (!/^\d{4}-\d{2}-\d{2}$/.test(closed)) fault(2, `${L}: closed '${closed}' is not YYYY-MM-DD`);
  } else if (closed) {
    fault(2, `${L}: closed '${closed}' is set but status is '${fm.status}' — only ${CLOSED_STATUSES.join('|')} may carry a close date`);
  }
  // Global rule 7: on close the FILE moves to archive/ with its row.
  if (fm.status) {
    const want = closedState ? 'archive' : 'pids';
    if (dir !== want) fault(2, `${L}: status '${fm.status}' belongs in ${want}/ but the file is in ${dir}/ (global rule 7)`);
  }
}

/* ─── the single scan ─────────────────────────────────────────────────────── */
export function scan() {
  const pidRecords = [];
  for (const dir of ['pids', 'archive']) {
    if (!existsSync(DIRS[dir])) continue;
    for (const f of readdirSync(DIRS[dir]).sort()) {
      if (!f.endsWith('.md')) continue;
      const stem = f.slice(0, -3);
      if (!ID_RE.test(stem)) {
        /**
         * A NON-CONFORMING STEM IN pids/ IS A FAULT, NOT A SKIP.
         *
         * GEN-032 was dispatched as `W3-3b-ii` and probed it: a `pids/W3-3b-ii.md`
         * file left this checker reporting `OK — Next allocation: 032`. The file
         * was not rejected; IT WAS NOT SEEN. So it sat OUTSIDE the allocation
         * authority global rule 1 defines — invisible to `max(NNN)+1` and to the
         * duplicate check — which is worse than a rejection, because a PID that
         * nothing counts can have its number handed to someone else.
         *
         * `archive/` keeps the silent skip on purpose: it holds PID-INDEX-ARCHIVE.md
         * and other generated companions that are not PIDs and never were. `pids/`
         * holds nothing but PIDs, so anything else there is a mistake.
         */
        if (dir === 'pids') {
          fault(2, `pids/${f}: stem '${stem}' is not <TYPE>-NNN, so the allocator CANNOT SEE IT — ` +
            `it is outside pids/+archive/ as an allocation authority (global rule 1), invisible to ` +
            `max(NNN)+1 and to the duplicate check. Rename it to the id the register allocates; a ` +
            `batch label belongs in the title, never in the filename.`);
        }
        continue;                                   // PID-INDEX-ARCHIVE.md and friends
      }
      const p = path.join(DIRS[dir], f);
      const parsed = parseFrontMatter(readFileSync(p, 'utf8'), path.relative(ROOT, p));
      if (!parsed) continue;
      pidRecords.push({ path: p, dir, stem, fm: parsed.fm, h1Id: parsed.h1Id, title: parsed.title, nnn: stem.split('-')[1] });
    }
  }
  const reportFiles = existsSync(DIRS.reports)
    ? readdirSync(DIRS.reports).sort().filter((f) => f.endsWith('.md'))
    : [];
  return { pidRecords, reportFiles };
}

/* ─── checks, all from that one scan ──────────────────────────────────────── */

/**
 * Duplicate NNN. Catches BOTH shapes:
 *   (a) one number under two type prefixes  — DOC-002 vs GEN-002, the collision that happened;
 *   (b) one id in two locations             — pids/X.md and archive/X.md, which global rule 7's
 *       file-move makes newly reachable if a move is ever done as a copy.
 * Keyed on distinct FILE, not on distinct token, because (b) shares a token.
 */
function checkDuplicates({ pidRecords }) {
  const byNnn = new Map();
  for (const r of pidRecords) {
    if (!byNnn.has(r.nnn)) byNnn.set(r.nnn, []);
    byNnn.get(r.nnn).push(r);
  }
  for (const [nnn, rs] of [...byNnn].sort()) {
    if (rs.length > 1) {
      fault(1, `duplicate NNN ${nnn} held by ${rs.length} files: ${rs.map((r) => path.relative(ROOT, r.path)).join(', ')}`);
    }
  }
}

/** reports/ is a cross-check, never a source (global rule 1). */
function checkOrphanReports({ pidRecords, reportFiles }) {
  const allocated = new Set(pidRecords.map((r) => r.stem));
  const seen = new Map();
  for (const f of reportFiles) {
    const m = f.match(TOKEN_RE);
    if (!m) continue;
    const token = `${m[1]}-${m[2]}`;
    if (!seen.has(token)) seen.set(token, []);
    seen.get(token).push(f);
  }
  for (const [token, files] of [...seen].sort()) {
    if (!allocated.has(token)) {
      fault(5, `orphan report: reports/ holds ${files.length} file(s) for '${token}' but no PID file exists in pids/ or archive/ — ${files.join(', ')}`);
    }
  }
}

/**
 * A closed PID must have a filed ruling. By rule 2 no PID closes without one, so
 * its absence is checkable — unlike an in-flight PID's, which is legitimately
 * indistinguishable from one not yet written. This walks pids/ -> reports/; the
 * orphan check walks reports/ -> pids/. Neither direction can see a report that
 * exists only outside the repository.
 */
function checkClosedHaveRulings({ pidRecords, reportFiles }) {
  for (const r of pidRecords) {
    if (!CLOSED_STATUSES.includes(r.fm.status)) continue;
    // A declared ruling is checked against the directory, never taken on trust:
    // a cross-reference nobody verifies is a `reports:` glob with better manners.
    if (r.fm.ruling) {
      if (!reportFiles.includes(r.fm.ruling)) {
        fault(6, `${r.stem} declares ruling: '${r.fm.ruling}' but reports/ holds no such file`);
      } else if (!r.fm.ruling.includes('-RULINGS-')) {
        fault(6, `${r.stem} declares ruling: '${r.fm.ruling}', which is not a -RULINGS- file`);
      }
      continue;
    }
    const rulings = reportFiles.filter((f) => f.startsWith(`${r.stem}-`) && f.includes('-RULINGS'));
    if (rulings.length === 0) {
      fault(6, `${r.stem} is '${r.fm.status}' but no file matching reports/${r.stem}-*-RULINGS-* ` +
        `(or reports/${r.stem}-RULINGS-*) exists — a PID does not close without a filed ruling ` +
        `(global rule 2). THE LITERAL PATTERN IS "-RULINGS-" IN THE FILENAME: a ruling filed under ` +
        `another name (e.g. "-CLOSE-") is invisible to this check, so carry it into reports/ under ` +
        `the -RULINGS- name. See docs/governance/00-START-HERE.md, rule 7.`);
    }
  }
}


/**
 * THE REGISTER-LANDING COMMIT. Every commit from here on is a PID commit — the
 * push model is linear (refspec from a worktree, no merge commits), so the
 * convention is not aspirational, it is what the history already does. This
 * check makes that guaranteed rather than merely true so far.
 */
const REGISTER_LANDED = '5b06361a5dd244659a7a48e26de0bf134cfb920b';
/** Commits exempt from the tag rule. Empty by design: add one only with a reason. */
const TAG_EXEMPT = new Set([]);

/**
 * Every commit since the register landed carries a [PID-ID] tag.
 *
 * This exists because the merged-but-draft check below rests ENTIRELY on the
 * tag: a commit without one is invisible to it, silently. A check built on an
 * unenforced convention inherits the convention's unreliability, so the
 * convention is enforced instead of documented.
 */
function checkCommitTags(git) {
  if (!git) return;
  let log;
  try {
    log = execFileSync('git', ['log', '--format=%H%x00%s', `${REGISTER_LANDED}..HEAD`], { cwd: REPO_ROOT, encoding: 'utf8' });
  } catch (e) {
    notes.push(`NOTE: commit-tag check SKIPPED — cannot read history from ${REGISTER_LANDED.slice(0, 7)} (${e.message.split('\n')[0]})`);
    return;
  }
  for (const line of log.split('\n').filter(Boolean)) {
    const [sha, subject] = line.split('\0');
    if (TAG_EXEMPT.has(sha)) continue;
    if (!TOKEN_RE.test(subject)) {
      fault(7, `commit ${sha.slice(0, 7)} carries no [PID-ID] tag: "${subject}" — the merged-but-draft check reads this tag, and an untagged commit is invisible to it`);
    }
  }
}

/**
 * MERGED-BUT-DRAFT: register status against shipped reality.
 *
 * Every other check here walks the directory. This one walks the COMMIT TRAIL,
 * because the register's own `write_scope` field is free prose — one PID's scope
 * is a predicate over file contents, another's is `none`, another's is a G-drive
 * path not in this repository at all. Parsing that would be a heuristic wrong in
 * ways nobody could predict.
 *
 * THE DISCRIMINATOR IS NOT "has a tagged commit". A PID's own allocation commit
 * carries its tag and lands while it is `draft`, so that form warns on every PID
 * immediately — a 100% false-positive rate, which is a guard nobody would leave
 * switched on. The signal is a tagged commit touching paths OUTSIDE
 * docs/governance/: allocations and closes are register-only, product code is
 * the thing that means the work has landed.
 *
 * IT WARNS AND NEVER FAILS, because it cannot separate two states:
 *   - landed and awaiting its close  (GEN-006, three commits — the real drift)
 *   - landed step 2 and legitimately continuing to step 3
 * Both look identical from here. The message says so rather than picking one.
 */
function checkMergedButDraft({ pidRecords }, git) {
  if (!git) return;
  for (const r of pidRecords) {
    if (CLOSED_STATUSES.includes(r.fm.status)) continue;
    let out = '';
    try {
      out = execFileSync('git',
        ['log', '--format=%h', `--grep=\\[${r.stem}\\]`, '-E', `${REGISTER_LANDED}..HEAD`, '--', '.', ':(exclude)docs/governance'],
        { cwd: REPO_ROOT, encoding: 'utf8' });
    } catch { continue; }
    const commits = out.split('\n').filter(Boolean);
    if (commits.length > 0) {
      notes.push(
        `WARNING: ${r.stem} is '${r.fm.status}' but ${commits.length} commit(s) tagged [${r.stem}] have landed outside docs/governance/ (${commits.join(', ')}). ` +
        `It is either merged-and-awaiting-close, or landed-and-legitimately-continuing — this check cannot tell those apart, so it warns and does not fail.`,
      );
    }
  }
}

/** Enumerate the FILESYSTEM, then interrogate git per file. Never ask git what exists. */
function checkTracked({ pidRecords }, requireGit) {
  const gitDirPresent = (() => {
    try { execFileSync('git', ['rev-parse', '--is-inside-work-tree'], { cwd: ROOT, stdio: 'pipe' }); return true; }
    catch { return false; }
  })();
  if (!gitDirPresent) {
    const msg = 'tracked-file, commit-tag and merged-but-draft checks SKIPPED — not inside a git work tree (core checks are unaffected)';
    if (requireGit) fault(4, `${msg}, and --require-git was given`);
    else notes.push(`NOTE: ${msg}. Pass --require-git to make this fatal.`);
    return false;
  }
  for (const r of pidRecords) {
    let ignored = false;
    try { execFileSync('git', ['check-ignore', '-q', r.path], { cwd: ROOT, stdio: 'pipe' }); ignored = true; }
    catch (e) { if (e.status !== 1) { fault(4, `git check-ignore failed for ${path.relative(ROOT, r.path)}: ${e.message}`); continue; } }
    if (ignored) fault(4, `${path.relative(ROOT, r.path)} is IGNORED by git — its number is held in the register but the file is absent from the repository`);
  }
  return true;
}

/* ─── rendering ───────────────────────────────────────────────────────────── */
const cell = (s) => String(s ?? '').replace(/\|/g, '\\|').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function reportsFor(id, reportFiles, fm) {
  const own = reportFiles.filter((f) => f.startsWith(`${id}-`));
  // The declared ruling joins the derived list; without it the record points at
  // nothing and the close is unexplainable from the register alone.
  if (fm?.ruling && reportFiles.includes(fm.ruling) && !own.includes(fm.ruling)) own.push(fm.ruling);
  return own.sort();
}

export function nextNumber({ pidRecords }) {
  const max = pidRecords.reduce((m, r) => Math.max(m, Number(r.nnn)), 0);
  return String(max + 1).padStart(3, '0');
}

function renderActive(scanned) {
  const { pidRecords } = scanned;
  const rows = pidRecords.filter((r) => !CLOSED_STATUSES.includes(r.fm.status)).sort((a, b) => a.nnn.localeCompare(b.nnn));
  const closedCount = pidRecords.length - rows.length;
  return `# PID-INDEX — active register

> **GENERATED — do NOT hand-edit.** Emitted by \`docs/governance/bin/pid-index.mjs\` from a single scan of
> \`pids/\` + \`archive/\` + \`reports/\`. Every column comes from a \`pids/<ID>.md\` front-matter key or its
> \`# <ID> — <title>\` heading; nothing here is authored. If this table goes stale it cannot cause a
> duplicate, because the directory — not this table — is authoritative (global rule 1).
>
> Regenerate: \`node docs/governance/bin/pid-index.mjs\` · Verify: \`… --check\` · Next number: \`… --next\`

| id | type | version | status | from → to | title |
|---|---|---|---|---|---|
${rows.map((r) => `| ${cell(r.stem)} | ${cell(r.fm.type)} | ${cell(r.fm.version)} | ${cell(r.fm.status)} | ${cell(r.fm.from)} → ${cell(r.fm.to)} | ${cell(r.title)} |`).join('\n')}

**Next allocation:** \`${nextNumber(scanned)}\` — over \`pids/\` + \`archive/\`, excluding \`ADR-NNN\`. A number, once allocated, is never reissued.

**Closed PIDs:** ${closedCount} — file and row both live in \`archive/\` (global rule 7). See \`archive/PID-INDEX-ARCHIVE.md\`.
`;
}

function renderArchive({ pidRecords, reportFiles }) {
  const rows = pidRecords.filter((r) => CLOSED_STATUSES.includes(r.fm.status)).sort((a, b) => a.nnn.localeCompare(b.nnn));
  return `# PID-INDEX-ARCHIVE — closed PIDs

> **GENERATED — do NOT hand-edit.** Emitted by \`docs/governance/bin/pid-index.mjs\` from the same single scan
> as the active index. On close, a PID's **file and row both move here** (global rule 7), so \`pids/\` holds only
> what is in flight and this directory stays part of the allocation authority — a retired number is still taken.
>
> The **record** column is derived from the \`reports/\` directory, not transcribed and not taken from the
> \`reports:\` glob. A hand-authored row inside a generated table is the defect this structure removes.
> The **note** column renders an optional \`note:\` field from the closed PID's own front-matter — for a
> row whose HISTORY needs a word the status cannot carry (e.g. a close-push run that reddened on an
> unrelated hazard and was fixed): a rendered field, so a clean row never sits over an unclean history.

| id | type | version | status | closed | title | record | note |
|---|---|---|---|---|---|---|---|
${rows.map((r) => {
  const rec = reportsFor(r.stem, reportFiles, r.fm);
  return `| ${cell(r.stem)} | ${cell(r.fm.type)} | ${cell(r.fm.version)} | ${cell(r.fm.status)} | ${cell(r.fm.closed)} | ${cell(r.title)} | ${rec.map((f) => `\`reports/${f}\``).join(', ') || '—'} | ${cell(r.fm.note) || '—'} |`;
}).join('\n')}
`;
}

/* ─── main ────────────────────────────────────────────────────────────────── */
const argv = process.argv.slice(2);
const mode = argv.includes('--check') ? 'check' : argv.includes('--next') ? 'next' : 'write';
const requireGit = argv.includes('--require-git');

const scanned = scan();                       // ← the one and only directory read
for (const r of scanned.pidRecords) validate(r);
checkDuplicates(scanned);
checkOrphanReports(scanned);
checkClosedHaveRulings(scanned);
const gitAvailable = mode !== 'next' ? checkTracked(scanned, requireGit) : false;
checkCommitTags(gitAvailable);
checkMergedButDraft(scanned, gitAvailable);

if (mode === 'next') {
  if (faults.length === 0) { process.stdout.write(nextNumber(scanned) + '\n'); process.exit(0); }
}

const active = renderActive(scanned);
const archive = renderArchive(scanned);

if (mode === 'check') {
  for (const [file, want] of [[INDEX, active], [ARCHIVE_INDEX, archive]]) {
    const got = existsSync(file) ? readFileSync(file, 'utf8') : null;
    if (got === null) fault(3, `${path.relative(ROOT, file)} does not exist — run without --check to generate it`);
    else if (got !== want) fault(3, `${path.relative(ROOT, file)} DRIFT — the committed file is not what the directory generates`);
  }
} else if (mode === 'write' && faults.length === 0) {
  writeFileSync(INDEX, active);
  writeFileSync(ARCHIVE_INDEX, archive);
}

for (const n of notes) process.stderr.write(n + '\n');
if (faults.length) {
  // INDEX DRIFT MUST NOT MASK ITS OWN CAUSE. Almost every other fault also
  // drifts the index — add a file, remove a ruling, rename an id, and the
  // generated table stops matching. Exiting on the lowest code would report 3
  // for all of them and hide the reason. Drift is a SYMPTOM; it is the exit
  // code only when it is the sole fault, i.e. when someone hand-edited the
  // table and nothing else is wrong.
  const primary = faults.filter((f) => f.code !== 3);
  const worst = Math.min(...(primary.length ? primary : faults).map((f) => f.code));
  for (const f of faults.sort((a, b) => a.code - b.code)) process.stderr.write(`[exit ${f.code}] ${f.msg}\n`);
  process.stderr.write(`\n${faults.length} fault(s); exiting ${worst}\n`);
  process.exit(worst);
}
if (mode === 'write') process.stdout.write(`PID-INDEX.md and archive/PID-INDEX-ARCHIVE.md regenerated. Next allocation: ${nextNumber(scanned)}\n`);
else process.stdout.write(`OK — index matches the directory. Next allocation: ${nextNumber(scanned)}\n`);
