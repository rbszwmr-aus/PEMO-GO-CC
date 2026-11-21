/**
 * STANDING PROOF THAT THE NOTICES ASSERTIONS CAN GO RED.
 *
 *     pnpm run prove:notices
 *
 * Every assertion UI-045 and UI-051 add is proven by making it fail, and proven HERE rather
 * than in a memory of having once run something. "It did not fire" and "it cannot
 * fire" are indistinguishable without this, which is the failure this project
 * keeps meeting in new costumes.
 *
 * EACH MUTATION MUST REDDEN THE ASSERTION IT NAMES, AND NOT MERELY SOMETHING.
 * A mutation that turns the suite red for a different reason has proved nothing
 * about its target — it has proved the app can break, which was never in doubt.
 * `proveMutations` compares against the named target and reports what went red
 * instead when it misses.
 *
 * The browser mutations REBUILD, because the browser suite runs against the
 * production bundle in dist/. Mutating a source file without rebuilding would
 * leave the suite testing the unmutated artefact and report every assertion as
 * unprovable — the did-it-apply failure one level up.
 */

import { execFileSync } from 'node:child_process';
import { APP_ROOT } from './corpus-source.ts';
import { proveMutations, type Mutation, type Reds } from './mutate.ts';

type Suite = 'node' | 'browser';

interface NoticeMutation extends Mutation {
  suite: Suite;
}

const MUTATIONS: NoticeMutation[] = [
  /* ---- 1. one state per screen, reddening for its OWN reason ---- */
  {
    id: 'm1-list-discriminator',
    suite: 'browser',
    target: 's5 · list · en',
    note: 'the list state must render its own discriminator, not merely a page',
    // NARROWED under R1. This first mutated `data-testid={testId}` in the SHARED
    // Table component, which reddened s1, s3, s4 and s5 alike — and under the old
    // `.some()` certification it scored, because the target was somewhere in the
    // wreckage. A mutation aimed at the notices list must edit the notices list.
    edits: [['src/screens/S5Notices.tsx', 'testId="s5-table"', 'testId="s5-table-x"']],
    // The list's discriminator is shared by its two fixture states and both
    // locales — that is the screen, not spillage into other screens.
    alsoRed: ['s5 · list · zh-Hant', 's5 · lifecycle · en', 's5 · lifecycle · zh-Hant'],
  },
  {
    id: 'm2-detail-discriminator',
    suite: 'browser',
    target: 's5detail · detail · en',
    note: 'the detail state is discriminated by its history chain',
    edits: [['src/screens/S5Notices.tsx', 'data-testid="notice-history"', 'data-testid="notice-history-x"']],
    alsoRed: ['s5detail · detail · zh-Hant'],
  },
  {
    id: 'm3-ack-table-discriminator',
    suite: 'browser',
    target: 's5ack · outstanding · en',
    note: 'the outstanding state must render its own discriminator — the recipients table — not merely a page',
    // RE-POINTED AT UI-051. Part 1 aimed this at the gap panel's REASON, because
    // getNoticeOutstanding had no fixture and the screen was a stated absence.
    // GEN-047 gave it a fixture (UI-045 G1 closed), so the state is a renderer and
    // its discriminator is the table. The radius is the same screen in the other
    // locale, and nothing else.
    edits: [['src/screens/S5Notices.tsx', 'testId="s5ack-table"', 'testId="s5ack-table-x"']],
    alsoRed: ['s5ack · outstanding · zh-Hant'],
  },

  /* ---- 2. an unregistered claim ---- */
  {
    id: 'm4-unregistered-claim',
    suite: 'node',
    target: 'EVERY client-authored string is classified',
    note: 'a new user-visible sentence with no disposition in the register',
    edits: [[
      'src/i18n/messages.ts',
      "    noticeType: {",
      "    smuggledClaim: m('There are no other notices in this estate.', '本屋苑並無其他通告。'),\n    noticeType: {",
    ]],
  },

  /* ---- 3. a fixture-bound value ---- */
  {
    id: 'm5-fixture-bound-title',
    suite: 'browser',
    target: 'the list renders every notice the fixture carries',
    note: 'the rendered title stops being the fixture’s own string',
    // RE-POINTED AT UI-051: the list now renders the title in the CURRENT locale
    // (G2 closed at 2.1.0), so the fixture-bound expression changed shape.
    edits: [['src/screens/S5Notices.tsx', "                        {locale === 'zh-Hant' ? n.titleZhHant : n.titleEn}", '                        {`Notice ${n.version}`}']],
    alsoRed: ['the list title follows the locale: English on en, Traditional Chinese on zh-Hant'],
  },
  {
    id: 'm6-fixture-bound-history-order',
    suite: 'browser',
    target: 'the disposition history is the fixture chain, in order',
    note: 'the chain is reversed — an unordered assertion would not notice',
    edits: [['src/screens/S5Notices.tsx', '{n.history.map((h) => (', '{[...n.history].reverse().map((h) => (']],
  },

  /* ---- 4. a hard-coded user-visible string ---- */
  {
    id: 'm7-hardcoded-string',
    suite: 'node',
    target: 'NO user-visible string is typed directly into JSX',
    note: 'RE-POINTED: this mutation was written against the forbidden-terms scan and stayed GREEN, because that scan walks MESSAGES and never sees a JSX literal. The hole it found is why no-jsx-literal-copy.test.ts exists',
    edits: [[
      'src/screens/S5Notices.tsx',
      '<h2 className="pemo-panel__title">{t(M.historyHeading, locale)}</h2>',
      '<h2 className="pemo-panel__title">Sensor reading history</h2>',
    ]],
  },

  /* ---- 5. a lifecycle control ---- */
  {
    id: 'm8-approve-button',
    suite: 'browser',
    target: 's5detail · detail · en',
    note: 'an Approve control appears — part 1 must render none, marked or not',
    // RE-AIMED under R1, and this one was a FALSE BITE. The anchor matched the
    // FIRST component with that shape — S5List, not S5Detail — so the button went
    // onto the list while the mutation claimed to prove the detail's guard. The
    // old `.some()` certification passed it anyway. The anchor is now unique to
    // S5Detail, so the control lands where the target asserts.
    edits: [[
      'src/screens/S5Notices.tsx',
      '        <ol className="pemo-steps" data-testid="notice-history">',
      '        <button type="button">Approve</button>\n        <ol className="pemo-steps" data-testid="notice-history">',
    ]],
    alsoRed: ['s5detail · detail · zh-Hant'],
  },

  /* ---- 6. client-side role reasoning ---- */
  {
    id: 'm9-role-branch',
    suite: 'node',
    target: 'NO client source compares against a role name',
    note: 'the client starts deciding what an approver may see',
    // DECLARED, not suppressed. `.role === 'approver'` trips both role guards by
    // design — one matches the role LITERAL, the other the `.role ===` comparison.
    // They overlap deliberately, so the second red is the mutation working, and the
    // honest move is to say so rather than to contrive a comparison that dodges it.
    alsoRed: ['no client source reads a role off a payload'],
    edits: [[
      'src/screens/S5Notices.tsx',
      "  const isDraft = n.lifecycleState === 'draft';",
      "  const isDraft = n.lifecycleState === 'draft';\n  const mayApprove = (data.meta as unknown as { role?: string }).role === 'approver';\n  void mayApprove;",
    ]],
  },
  {
    id: 'm10-client-storage',
    suite: 'node',
    target: 'no credential or identity is stored client-side',
    note: 'the token gets remembered, which the readout measured at zero',
    // RE-AIMED under R1. This first edited live-config.ts, where `readLiveConfig`
    // runs inside the node suite: `localStorage` does not exist there, so an
    // unrelated live-config test died with `ReferenceError: localStorage is not
    // defined`. That red is a CRASH, not a second assertion about storage — the
    // exact shape GEN-044 found being counted as a bite. The guard is a static
    // scan over src/**, so any source file proves it; this one proves it without
    // also breaking an unrelated runtime.
    edits: [[
      'src/screens/S5Notices.tsx',
      "  const [cursor, setCursor] = useState(0);",
      "  const [cursor, setCursor] = useState(0);\n  void localStorage.getItem('remembered-filter');",
    ]],
  },

  /* ================================================================ UI-051 */
  /* ---- 7. D1: a control hard-coded visible ---- */
  {
    id: 'm11-hardcoded-control',
    suite: 'browser',
    target: 'the detail action bar is exactly the server’s permitted list, in contract order',
    note: 'an Approve control is rendered whatever the server said — the D1 bite, direction one',
    // The ONLY file that may render an act control, so the mutation goes there. The
    // matrix cells for the detail also see the unpermitted control; declared.
    edits: [[
      'src/screens/NoticeActions.tsx',
      "      {ops.length === 0 ? (",
      "      <ActButton op=\"approveNotice\" locale={locale} />\n      {ops.length === 0 ? (",
    ]],
    alsoRed: [
      's5detail · detail · en', 's5detail · detail · zh-Hant',
      's5 · list · en', 's5 · list · zh-Hant', 's5 · lifecycle · en', 's5 · lifecycle · zh-Hant',
      'every row’s controls equal that row’s permitted list',
      'the notice nobody can approve is ON SCREEN, and nothing offers to approve it',
    ],
  },
  /* ---- 8. D1: visibility derived from the STATE instead of the list ---- */
  {
    id: 'm12-state-derived-visibility',
    suite: 'browser',
    target: 'every row’s controls equal that row’s permitted list',
    note: 'the client decides from lifecycleState what a draft or a pending notice allows — reds on the lifecycle fixture, where the server disagrees',
    // A plausible table: drafts may be revised and submitted, pending may be
    // approved or declined, live may be corrected or withdrawn. It is WRONG on this
    // corpus in both directions — the draft may also be published, and the pending
    // notice may not be approved by this caller — which is the point of D1.
    edits: [[
      'src/screens/NoticeActions.tsx',
      "  const ops = permittedOf(target).filter(isTransition);",
      "  const STATE_TABLE: Record<string, NoticeTransition[]> = {\n" +
      "    draft: ['reviseNotice', 'submitNotice'], pending_approval: ['approveNotice', 'declineNotice'],\n" +
      "    approved: ['publishNotice'], scheduled: ['correctNotice', 'withdrawNotice'],\n" +
      "    live: ['correctNotice', 'withdrawNotice'], expired: ['correctNotice', 'withdrawNotice'], withdrawn: [],\n" +
      "  };\n" +
      "  const ops = STATE_TABLE[(target as unknown as { lifecycleState?: string }).lifecycleState ?? ''] ?? permittedOf(target).filter(isTransition);",
    ]],
    // Every cell that renders act controls from a notice sees the table's answer
    // where it differs from the server's; the node guards see the literals.
    // list.json disagrees too — its draft (ntc_0820_bbq) lists publishNotice — so
    // the per-row exact check reds on both list fixtures. Declared after the first
    // run reported the list cells as collateral: the radius IS the finding.
    alsoRed: [
      's5 · lifecycle · en', 's5 · lifecycle · zh-Hant',
      's5 · list · en', 's5 · list · zh-Hant',
      'the notice nobody can approve is ON SCREEN, and nothing offers to approve it',
    ],
  },
  {
    id: 'm12n-state-derived-visibility-is-caught-statically',
    suite: 'node',
    target: 'the act-control file reasons about nothing',
    note: 'the same table, seen by the source guard before any browser runs',
    edits: [[
      'src/screens/NoticeActions.tsx',
      "  const ops = permittedOf(target).filter(isTransition);",
      "  const ops = (target as unknown as { lifecycleState?: string }).lifecycleState === 'draft' ? (['reviseNotice'] as NoticeTransition[]) : permittedOf(target).filter(isTransition);",
    ]],
  },
  /* ---- 9. D1: a second reader of permittedActions ---- */
  {
    id: 'm13-second-reader',
    suite: 'node',
    target: 'permittedActions is read by the affordance module and the type layer only',
    note: 'a screen starts reading the list for itself — a second decision procedure',
    edits: [[
      'src/screens/S5Notices.tsx',
      "  const isDraft = n.lifecycleState === 'draft';",
      "  const isDraft = n.lifecycleState === 'draft';\n  void n.permittedActions.length;",
    ]],
  },
  /* ---- 10. D1: an act control rendered outside the one file ---- */
  {
    id: 'm14-control-elsewhere',
    suite: 'node',
    target: 'exactly one file renders an act control',
    note: 'a button with data-act appears in a screen file',
    edits: [[
      'src/screens/S5Notices.tsx',
      '        <h2 className="pemo-panel__title">{t(M.historyHeading, locale)}</h2>',
      '        <button type="button" data-act="withdrawNotice">{t(M.historyHeading, locale)}</button>\n        <h2 className="pemo-panel__title">{t(M.historyHeading, locale)}</h2>',
    ]],
  },
  /* ---- 11. D4: the refusals collapse into one generic panel ---- */
  {
    id: 'm15-generic-refusal',
    suite: 'node',
    target: 'the presentations are DISTINCT — no two notices refusals share a title',
    note: 'every notices refusal gets the same title — the half-translated publish looks like a stale version',
    edits: [[
      'src/data/problem-presentation.ts',
      "  'https://pemo.local/problems/notice-incomplete-translation': MESSAGES.s5.refusalIncompleteTranslation,",
      "  'https://pemo.local/problems/notice-incomplete-translation': MESSAGES.s5.refusalStaleVersion,",
    ]],
    // The same collapse also breaks "names the missing language"; declared.
    alsoRed: ['the bilingual-missing refusal names the missing language, not a generic failure'],
  },
  {
    id: 'm15b-refusal-by-prose',
    suite: 'browser',
    // RE-POINTED AT UI-054: the target was renamed when 2.2.0 gave wrong-state its
    // own fixture. Every test that reads data-problem-kind reddens with it; declared.
    target: 'a refusal is presented by TYPE: wrong-state and stale-version are distinct states, distinguished by type',
    note: 'the type discriminator is dropped from the rendered panel',
    alsoRed: [
      'every 2.2.0 refusal fixture is bound to a state and renders by its own type',
      'the incomplete-translation refusal renders by its own type',
    ],
    edits: [[
      'src/components/StateNotice.tsx',
      '      data-problem-kind={kind}',
      '      data-problem-kind="refused"',
    ]],
  },
  /* ---- 12. D2: the form grows a field the contract does not name ---- */
  {
    id: 'm16-extra-field',
    suite: 'browser',
    target: 'the compose form is ComposeNoticeRequest, field for field',
    note: 'a "priority" field appears on the compose form; the contract has none',
    edits: [[
      'src/screens/S5NoticesWrite.tsx',
      '      <p className="pemo-note">{t(M.authoringNote, locale)}</p>\n      <div className="pemo-form__languages">',
      '      <input name="priority" data-form-field="true" />\n      <p className="pemo-note">{t(M.authoringNote, locale)}</p>\n      <div className="pemo-form__languages">',
    ]],
  },
  /* ---- 13. D4: a missing language stops being flagged ---- */
  {
    id: 'm17-missing-language-unflagged',
    suite: 'browser',
    target: 'a missing language is a state of the form',
    // FOUND A WEAK TEST on its first run: the assertion cleared a TITLE and never a
    // body, so a flag that read only the title stayed green. The test now clears a
    // body too. A mutation that does not bite is a question about the test first.
    note: 'the flag reads only the title, so an empty body passes as present',
    edits: [[
      'src/screens/S5NoticesWrite.tsx',
      "  return x.title.trim().length === 0 || x.body.trim().length === 0;",
      "  return x.title.trim().length === 0;",
    ]],
  },
  /* ---- 14. D3: the confirm sends without the recorded fromVersion ---- */
  {
    id: 'm18-confirm-not-prefilled',
    suite: 'browser',
    target: 'each transition confirm is prefilled from its recorded request and carries exactly its act',
    note: 'fromVersion is no longer taken from the request — a retry would name the wrong version',
    edits: [[
      'src/screens/S5NoticesWrite.tsx',
      "    fromVersion: String(r.fromVersion),",
      "    fromVersion: '1',",
    ]],
  },
  /* ---- 15. D3: the recorded response is not what is rendered ---- */
  {
    id: 'm19-recorded-version',
    suite: 'browser',
    target: 'composing in fixture mode returns the recorded response, then opens the notice',
    note: 'the recorded state shows a version the response did not carry',
    edits: [[
      'src/screens/S5NoticesWrite.tsx',
      '        <dd data-testid="recorded-version">{data.version}</dd>',
      '        <dd data-testid="recorded-version">{data.version + 1}</dd>',
    ]],
    alsoRed: ['confirming in fixture mode returns the recorded response for THAT act'],
  },
  /* ---- 16. D3: relative time from the wall clock instead of the response ---- */
  {
    id: 'm20-wall-clock',
    suite: 'browser',
    target: 'stateEnteredAt is shown beside the state as relative time from the response’s own clock',
    note: 'the age is measured from Date.now() — the fixture would read "weeks ago" today and something else tomorrow',
    edits: [[
      'src/screens/S5Notices.tsx',
      "        {t(MESSAGES.s5.since, locale)} {relativeTime(enteredAt, now, locale)}",
      "        {t(MESSAGES.s5.since, locale)} {relativeTime(enteredAt, new Date().toISOString(), locale)}",
    ]],
  },
  /* ---- 17. D6: the outstanding list is re-sorted client-side ---- */
  {
    id: 'm21-ack-resorted',
    suite: 'browser',
    target: 'the outstanding screen renders the fixture’s recipients, in the server’s order',
    note: 'the client sorts recipients by id — the server’s unacknowledged-first rule is replaced by a copy',
    edits: [[
      'src/screens/S5Notices.tsx',
      "            {data.recipients.map((r) => (",
      "            {[...data.recipients].sort((a, b) => b.residentId.localeCompare(a.residentId)).map((r) => (",
    ]],
  },
  /* ---- 18. D7: a rendered field with no register entry ---- */
  {
    id: 'm22-unregistered-copy',
    suite: 'node',
    target: 'EVERY client-authored string is classified',
    note: 'a new sentence on the compose form with no disposition',
    edits: [[
      'src/i18n/messages.ts',
      "    composeTitle: m('Compose a notice', '撰寫通告'),",
      "    composeTitle: m('Compose a notice', '撰寫通告'),\n    composeHint: m('Most notices here are about the lifts.', '此處大多數通告與升降機有關。'),",
    ]],
  },
  /* ---- 19. the act vocabulary drifts from the contract ---- */
  {
    id: 'm23-vocabulary-drift',
    suite: 'node',
    target: 'the act vocabulary is the contract’s enum, not a hand-list',
    note: 'a nineteenth act is added to the client list that the contract does not declare',
    edits: [[
      'src/data/types.ts',
      "  'removeMembership', 'reviseNotice', 'revokeGrant', 'submitNotice', 'withdrawNotice',",
      "  'removeMembership', 'reviseNotice', 'revokeGrant', 'submitNotice', 'withdrawNotice', 'archiveNotice',",
    ]],
    // The value-map totality test reads the same enum and now finds a key the
    // contract does not declare? No — the MAP is unchanged; only the type tuple
    // grew. The compile step catches nothing either, since the tuple is the type's
    // source. So this red is the guard's alone.
  },

  /* ================================================================ UI-054 */
  /* ---- 20. D1: compose entry drawn from depth instead of the list ---- */
  {
    id: 'm24-compose-from-depth',
    suite: 'browser',
    target: 'the compose entry is on exactly the property-tree nodes that list composeNotice',
    note: 'the control appears for estate and buildings only, by depth — a floor that lists composeNotice loses it',
    edits: [[
      'src/screens/NoticeActions.tsx',
      "  if (!permits(node, 'composeNotice')) return null;",
      "  if (node.depth > 1) return null;",
    ]],
  },
  {
    id: 'm24n-compose-from-kind-is-caught-statically',
    suite: 'node',
    target: 'the act-control file reasons about nothing — no state, disposition, role or scope-kind literal',
    note: 'the same idea by KIND — the scope-kind literal is refused by the source guard before any browser runs',
    edits: [[
      'src/screens/NoticeActions.tsx',
      "  if (!permits(node, 'composeNotice')) return null;",
      "  if (node.node.kind === 'floor' || node.node.kind === 'unit') return null;",
    ]],
  },
  /* ---- 21. D2: the reason subset typed by hand ---- */
  {
    id: 'm25-hardcoded-reason-subset',
    suite: 'node',
    target: 'NO reason code is typed into the write screen',
    note: 'the decline subset is written into the screen instead of read from the generated registry',
    edits: [[
      'src/screens/S5NoticesWrite.tsx',
      "  const reasons = NOTICE_REASONS[op];",
      "  const reasons = op === 'declineNotice' ? { required: true, codes: ['inaccurate', 'wrong_audience'] as const } : NOTICE_REASONS[op];",
    ]],
  },
  {
    id: 'm25b-stale-generated-reasons',
    suite: 'node',
    target: 'src/data/notice-reasons.g.ts is not stale',
    note: 'a code is edited into the generated file by hand — regenerate-and-compare catches it',
    edits: [[
      'src/data/notice-reasons.g.ts',
      '  "with_amendments",',
      '  "with_amendments",\n  "other",',
    ]],
    // The union then disagrees with the contract too; both are the same drift seen twice.
    alsoRed: ['the union equals the contract’s reasonCode enum'],
  },
  /* ---- 22. D5: the inventory disagrees with the runner ---- */
  {
    id: 'm26-inventory-vs-runner',
    suite: 'node',
    target: 'the inventory totals agree with what the suites actually run',
    note: 'a loop’s recorded count is one short of what Playwright collects — the joint-landing defect, now caught against the runner rather than a typed total',
    edits: [[
      'test/inventory/inventory.ts',
      "file: 'test/browser/data-claims.spec.ts', count: 80, cls: 'content-derived',",
      "file: 'test/browser/data-claims.spec.ts', count: 79, cls: 'content-derived',",
    ]],
  },
];

/**
 * Failing assertions AND THEIR LOGS from `node --test`.
 *
 * The log is not decoration. Under GEN-044's rule a bite is a NAMED red with its
 * own reason attached, so a runner that returns bare names cannot certify
 * anything — see the contract on `proveMutations`.
 */
function runNode(): Reds {
  const reds: Reds = new Map();
  let text = '';
  try {
    execFileSync('node', ['--test', '--experimental-strip-types', 'test/**/*.test.ts'], {
      cwd: APP_ROOT, encoding: 'utf8', stdio: 'pipe', shell: true,
    });
    return reds;
  } catch (e) {
    text = `${(e as { stdout?: string }).stdout ?? ''}${(e as { stderr?: string }).stderr ?? ''}`;
  }

  // node --test prints a "failing tests:" digest: each entry is a `test at <loc>`
  // line, the `✖ name` line, then that failure's own output. Split on the
  // location lines so each name keeps ITS OWN log rather than the next one's.
  const digest = text.slice(text.indexOf('failing tests:'));
  for (const block of digest.split(/^test at .*$/m)) {
    const m = block.match(/^✖ (.+?)(?: \([\d.]+ms\))?$/m);
    if (!m) continue;
    const name = (m[1] as string).trim();
    if (!name || name === 'failing tests:') continue;
    reds.set(name, block.slice(block.indexOf(m[0]) + m[0].length).trim());
  }
  return reds;
}

/**
 * Failing assertions and their logs from Playwright. Rebuilds first — dist/ is
 * what the browser suite runs, so mutating source without rebuilding would test
 * the unmutated artefact.
 *
 * THE BUILD IS OUTSIDE THE try. A mutation that breaks the build must abort the
 * run loudly, never be scored: "the build failed" is precisely the non-assertion
 * that GEN-044 found being counted as a bite.
 */
function runBrowser(): Reds {
  const reds: Reds = new Map();
  execFileSync('pnpm', ['run', 'build'], { cwd: APP_ROOT, encoding: 'utf8', stdio: 'pipe', shell: true });
  let text = '';
  try {
    execFileSync('npx', ['playwright', 'test', '--reporter=list'], {
      cwd: APP_ROOT, encoding: 'utf8', stdio: 'pipe', shell: true,
    });
    return reds;
  } catch (e) {
    text = `${(e as { stdout?: string }).stdout ?? ''}${(e as { stderr?: string }).stderr ?? ''}`;
  }

  // The numbered failure blocks: "  1) [project] › file › name ───" then the log,
  // until the next numbered block. Split on the numbering so each keeps its own.
  for (const block of text.split(/\n\s{2}\d+\) /).slice(1)) {
    const head = (block.split('\n')[0] ?? '').replace(/[─\s]+$/, '');
    const parts = head.split('›').map((x) => x.trim()).filter(Boolean);
    const name = parts[parts.length - 1];
    if (!name) continue;
    reds.set(name, block.slice(head.length).trim());
  }
  return reds;
}

const only = process.argv[2];
const chosen = only ? MUTATIONS.filter((m) => m.suite === only || m.id === only) : MUTATIONS;

// Each suite is proven under its own control, so a browser mutation is never
// judged by a node run that could not have seen it.
let failures = 0;
for (const suite of ['node', 'browser'] as Suite[]) {
  const batch = chosen.filter((m) => m.suite === suite);
  if (batch.length === 0) continue;
  console.log(`\n=== ${suite} mutations (${batch.length}) ===`);
  const results = proveMutations(batch, suite === 'node' ? runNode : runBrowser);
  failures += results.filter((r) => !r.proven).length;
}

console.log(`\n${failures === 0 ? 'ALL PROVEN' : `${failures} NOT PROVEN`}`);
process.exit(failures === 0 ? 0 : 1);
