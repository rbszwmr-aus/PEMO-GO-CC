/**
 * NO HARD-CODED USER-VISIBLE STRING (PID test 1).
 *
 * Every user-visible string comes from i18n (MESSAGES + t(...)); the only
 * visible strings that reach JSX do so as `{t(...)}` expressions, never as
 * literals. This walks the TypeScript AST of every .tsx and flags:
 *   - JSX text with visible content (a Latin letter or a CJK character);
 *   - a StringLiteral in a VISIBLE attribute position (aria-label, alt, …);
 *   - a `{'literal'}` child expression with visible content.
 *
 * THE EXHAUSTIVENESS RULE (Ruling 7, API-026-ST): a string-valued attribute
 * whose name is in NEITHER the visible NOR the non-visible set FAILS as
 * `unclassified`. It does not fall through to "non-visible". A classifier whose
 * fallback is a real category always passes its own completeness check — that is
 * how `label` became a residue on the management web (UI-024-ST). So a new
 * attribute position stops the scan until a human places it.
 *
 * Decorative marks (☰, ✕, severity/service glyphs) carry no letter or CJK and so
 * are not visible TEXT; they are aria-hidden and the label is the accessible name.
 */

import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join, relative } from 'node:path';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

import { APP_ROOT } from '../../tool/tokens-source.ts';

const SRC = join(APP_ROOT, 'src');

/**
 * The build-excluded dev affordance is not resident-facing — it is proven absent
 * from the production bundle by test/artefact/dev-affordance-excluded.test.ts, so
 * a string in it cannot reach a resident. The exemption is tied to that proof; it
 * is not a general loophole. Its own labels are dev tooling, not user copy.
 */
const EXEMPT_FILES = new Set(['src/shell/DevStateToolbar.tsx']);

/** String positions whose value is shown to a user — DOM attrs AND component
 *  props that render their string. A literal here must instead be `{t(...)}`. */
const VISIBLE_ATTRS = new Set([
  'aria-label', 'aria-description', 'alt', 'placeholder', 'title',
  'body', 'label', 'missing', // component visible-text props
]);

/** String positions whose value is never shown — DOM attrs AND my components'
 *  structural props. Anything in NEITHER set fails as `unclassified`. */
const NONVISIBLE_ATTRS = new Set([
  'className', 'role', 'type', 'href', 'id', 'key', 'value', 'tabindex', 'tabIndex',
  'name', 'htmlFor', 'rel', 'target', 'src', 'width', 'height', 'loading',
  'aria-hidden', 'aria-modal', 'aria-current', 'aria-selected', 'aria-pressed',
  'aria-live', 'aria-labelledby', 'aria-describedby', 'aria-required', 'aria-expanded',
  'kind', 'idPrefix', 'testId', 'state', // component structural props
]);

const isDataAttr = (name: string) => name.startsWith('data-');
/** Visible text = a Latin letter or a CJK ideograph. Symbols/punctuation are not. */
const hasVisibleText = (s: string) => /[A-Za-z]/.test(s) || /[㐀-鿿豈-﫿]/.test(s);

function tsxFiles(dir: string, out: string[] = []): string[] {
  for (const e of readdirSync(dir)) {
    const full = join(dir, e);
    if (statSync(full).isDirectory()) tsxFiles(full, out);
    else if (e.endsWith('.tsx') && !EXEMPT_FILES.has(relative(APP_ROOT, full))) out.push(full);
  }
  return out;
}

interface Findings { hardcoded: string[]; unclassified: string[] }

function scan(file: string): Findings {
  const rel = relative(APP_ROOT, file);
  const body = readFileSync(file, 'utf8');
  const sf = ts.createSourceFile(file, body, ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX);
  const hardcoded: string[] = [];
  const unclassified: string[] = [];
  const at = (n: ts.Node) => `${rel}:${sf.getLineAndCharacterOfPosition(n.getStart(sf)).line + 1}`;

  const visit = (node: ts.Node): void => {
    if (ts.isJsxText(node)) {
      if (hasVisibleText(node.text)) hardcoded.push(`${at(node)} — JSX text ${JSON.stringify(node.text.trim())}`);
    } else if (ts.isJsxAttribute(node) && node.initializer) {
      const name = node.name.getText(sf);
      const init = node.initializer;
      const literal =
        ts.isStringLiteral(init) ? init.text
        : ts.isJsxExpression(init) && init.expression && ts.isStringLiteral(init.expression)
          ? init.expression.text
          : undefined;
      if (literal !== undefined) {
        if (VISIBLE_ATTRS.has(name)) {
          if (hasVisibleText(literal)) hardcoded.push(`${at(node)} — visible attr ${name}=${JSON.stringify(literal)}`);
        } else if (NONVISIBLE_ATTRS.has(name) || isDataAttr(name)) {
          /* non-visible — ok */
        } else {
          unclassified.push(`${at(node)} — attribute ${JSON.stringify(name)} is neither visible nor non-visible`);
        }
      }
    } else if (ts.isJsxExpression(node) && node.expression && ts.isStringLiteral(node.expression)) {
      // A `{'literal'}` used as a JSX child. Only visible content is a problem.
      const parent = node.parent;
      const isChild = parent && (ts.isJsxElement(parent) || ts.isJsxFragment(parent));
      if (isChild && hasVisibleText(node.expression.text)) {
        hardcoded.push(`${at(node)} — JSX child literal ${JSON.stringify(node.expression.text)}`);
      }
    }
    ts.forEachChild(node, visit);
  };
  visit(sf);
  return { hardcoded, unclassified };
}

test('the scan reaches the app — an empty oracle agrees with everything', () => {
  const files = tsxFiles(SRC);
  assert.ok(files.length >= 8, `only ${files.length} .tsx files scanned; the walk is broken`);
});

test('no hard-coded user-visible string appears in any component', () => {
  const all = tsxFiles(SRC).flatMap((f) => scan(f).hardcoded);
  assert.deepEqual(all, [], `hard-coded visible string(s) — route through MESSAGES + t():\n  ${all.join('\n  ')}`);
});

test('every string-valued attribute position is CLASSIFIED — unknown fails, never defaults', () => {
  const all = tsxFiles(SRC).flatMap((f) => scan(f).unclassified);
  assert.deepEqual(
    all,
    [],
    `unclassified string attribute position(s). Place each in VISIBLE_ATTRS or NONVISIBLE_ATTRS ` +
      `deliberately — the fallback is NOT "non-visible":\n  ${all.join('\n  ')}`,
  );
});

test('the classifier is not vacuous — it catches a planted literal and an unknown position', () => {
  const dir = ts.createSourceFile(
    'x.tsx',
    `export const A = () => <div title="Hello">World<span frobnicate="Nope" /></div>;`,
    ts.ScriptTarget.Latest, true, ts.ScriptKind.TSX,
  );
  const hard: string[] = [];
  const unc: string[] = [];
  const walk = (n: ts.Node): void => {
    if (ts.isJsxText(n) && hasVisibleText(n.text)) hard.push('text');
    if (ts.isJsxAttribute(n) && n.initializer && ts.isStringLiteral(n.initializer)) {
      const name = n.name.getText(dir);
      if (VISIBLE_ATTRS.has(name)) { if (hasVisibleText(n.initializer.text)) hard.push('attr'); }
      else if (NONVISIBLE_ATTRS.has(name) || isDataAttr(name)) { /* ok */ }
      else unc.push(name);
    }
    ts.forEachChild(n, walk);
  };
  walk(dir);
  assert.ok(hard.includes('text'), 'did not catch hard-coded JSX text');
  assert.ok(hard.includes('attr'), 'did not catch a visible attribute literal');
  assert.ok(unc.includes('frobnicate'), 'did not fail on an unclassified attribute position');
});
