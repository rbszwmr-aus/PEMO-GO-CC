#!/usr/bin/env node
/**
 * READ A node --test RUN'S RESULT, IN ANY REPORTER FORMAT (GEN-048 F1).
 *
 * CI reported two suites that RAN as "did not run" — a false verdict. node's
 * default reporter is `spec` (`ℹ pass N`) when stdout is a TTY and `tap`
 * (`# pass N`) when it is not, and it flips with the node version too; the
 * battery's extractor matched only `ℹ`, so on the runner it matched nothing and
 * called a green suite dead. The same dead extractor would have called a RED
 * suite green with equal confidence.
 *
 * THE RULE (`[a-parser-that-cannot-read-the-result-must-not-report-one]`): a
 * parser that cannot read the result must not invent one. This distinguishes
 * three states and NEVER conflates the last two:
 *   RAN <pass> <fail> <skip>  — counts read (either format)
 *   EXTRACTOR-ERROR <why>     — the suite RAN (a duration or a tests line is
 *                               present) but the counts could not be read: the
 *                               EXTRACTOR is broken, not the suite.
 *   DID-NOT-RUN               — no sign of a run at all.
 *
 * Reads stdin; prints one line; exit 0. The caller decides the battery verdict.
 */
let input = '';
process.stdin.setEncoding('utf8');
process.stdin.on('data', (d) => { input += d; });
process.stdin.on('end', () => {
  const num = (label) => {
    // both `ℹ pass 12`, `# pass 12`, and a bare `pass 12`
    const m = input.match(new RegExp(`^(?:[#ℹ]\\s+)?${label}\\s+(\\d+)\\s*$`, 'm'));
    return m ? Number(m[1]) : undefined;
  };
  const ran = /^(?:[#ℹ]\s+)?(?:duration_ms|tests)\b/m.test(input);
  const pass = num('pass'); const fail = num('fail'); const skip = num('skipped');
  if (pass !== undefined && fail !== undefined) {
    process.stdout.write(`RAN ${pass} ${fail} ${skip ?? 0}\n`);
  } else if (ran) {
    // it ran — a duration or a tests line proves it — but the counts are
    // unreadable. That is the EXTRACTOR's failure, and it is loud.
    process.stdout.write(`EXTRACTOR-ERROR the suite ran (a duration/tests line is present) but pass/fail counts could not be parsed from this reporter format\n`);
  } else {
    process.stdout.write('DID-NOT-RUN\n');
  }
});
