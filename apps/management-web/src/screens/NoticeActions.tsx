/**
 * THE ONLY FILE THAT RENDERS AN ACT CONTROL (UI-051 D1).
 *
 * Every element that can start a write — a transition button on a notice, a
 * compose button on a scope node, the submit of the compose form, the confirm of
 * a transition — is rendered here and carries `data-act="<operationId>"`. The
 * guard in test/guard/affordances-read-not-reasoned.test.ts asserts three things
 * about this file and only this file:
 *
 *   1. `data-act` appears in no other source file;
 *   2. this file reads no lifecycle state, no disposition, no role and no scope —
 *      the vocabulary literals are derived from the contract and refused here;
 *   3. visibility comes from `permits` / `permittedOf` in data/affordances.ts and
 *      from nothing else.
 *
 * So the question "why is this button on screen?" has exactly one answer in the
 * whole client: the server listed its operationId. The state matrix then checks
 * the other direction on every rendered state — every `data-act` on screen is in
 * the fixture's permitted list, and every permitted act has a control.
 */

import { Icon, ICON_SIZE } from '../components/Icon.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { permits, permittedOf, type Permitting } from '../data/affordances.ts';
import {
  NOTICE_TRANSITIONS,
  type ActOperationId,
  type NoticeTransition,
  type ScopeTreeNode,
} from '../data/types.ts';

function actLabel(op: ActOperationId, locale: Locale): string {
  return t(MESSAGES.s5.act[op], locale);
}

const isTransition = (op: ActOperationId): op is NoticeTransition =>
  (NOTICE_TRANSITIONS as readonly string[]).includes(op);

/**
 * One act control. `type="submit"` for the form buttons, a plain button
 * otherwise. Never disabled: a control the caller may not use is ABSENT, and a
 * control the server permitted is pressable — "disabled with a reason" was
 * declined at GEN-047 A4 and is reopenable only by a screen that needs it.
 */
export function ActButton({
  op, locale, onClick, submit, primary, busy, testId, extra, label, icon,
}: {
  op: ActOperationId;
  locale: Locale;
  onClick?: (() => void) | undefined;
  submit?: boolean | undefined;
  primary?: boolean | undefined;
  busy?: boolean | undefined;
  testId?: string | undefined;
  extra?: Record<string, string> | undefined;
  /** A shorter visible label; the full act name stays as the accessible name and tooltip. */
  label?: string | undefined;
  icon?: 'NotebookPen' | undefined;
}) {
  return (
    <button
      type={submit ? 'submit' : 'button'}
      className={`pemo-button${primary ? ' pemo-button--primary' : ''}`}
      data-act={op}
      data-testid={testId ?? 'act-control'}
      disabled={busy === true}
      onClick={onClick}
      {...(label ? { 'aria-label': actLabel(op, locale), title: actLabel(op, locale) } : {})}
      {...extra}
    >
      {icon && !busy ? <Icon name={icon} size={ICON_SIZE.control} /> : null}
      {busy ? t(MESSAGES.s5.sending, locale) : (label ?? actLabel(op, locale))}
    </button>
  );
}

/**
 * The transition controls of ONE notice, in contract order. Empty renders the
 * server's answer as a sentence rather than an empty box: "nothing is permitted
 * to you now" is information, and the notice nobody can approve is the clearest
 * evidence the project has about who may.
 */
export function ActionBar({
  target, locale, onAct, dense, noticeId,
}: {
  target: Permitting;
  locale: Locale;
  onAct: (op: NoticeTransition) => void;
  dense?: boolean | undefined;
  noticeId?: string | undefined;
}) {
  const ops = permittedOf(target).filter(isTransition);
  return (
    <div
      className={`pemo-actions${dense ? ' pemo-actions--row' : ''}`}
      data-testid="action-bar"
      data-permitted-count={ops.length}
      data-notice-id={noticeId}
    >
      {ops.length === 0 ? (
        <span className="pemo-meta" data-testid="no-permitted-actions">
          {t(MESSAGES.s5.noPermittedActions, locale)}
        </span>
      ) : (
        ops.map((op) => (
          <ActButton key={op} op={op} locale={locale} onClick={() => onAct(op)} />
        ))
      )}
    </div>
  );
}

/**
 * The compose control for ONE tree node (UI-051 G6, ruled at its close): the
 * property tree is the canonical node picker, so every node that lists
 * composeNotice carries this, and nothing else decides — not the node's kind, not
 * its depth. Returns null when the server did not list it: absent, never disabled.
 */
export function ComposeOnNode({
  node, locale, onCompose, primary,
}: {
  node: ScopeTreeNode;
  locale: Locale;
  onCompose: (node: ScopeTreeNode) => void;
  primary?: boolean | undefined;
}) {
  if (!permits(node, 'composeNotice')) return null;
  return (
    <ActButton
      op="composeNotice"
      locale={locale}
      primary={primary}
      label={t(MESSAGES.s5.composeShort, locale)}
      icon="NotebookPen"
      onClick={() => onCompose(node)}
      testId="compose-on-node"
      extra={{ 'data-node-kind': node.node.kind, 'data-node-id': node.node.id }}
    />
  );
}
