/**
 * Admin > Lists. Staff keep the managed lists the app offers in forms and filters: add a type, rename it
 * in English, 繁體 and 简体, move it up or down, deactivate or reactivate it. Codes never appear here; a type
 * is what its name says.
 *
 * Delete shows only for a type no record is known to use, and never for the fallback type (Other), which
 * also has no Deactivate. When Backend refuses a delete because records use the type, the page says so and
 * points at Deactivate instead. Actions that do not apply are not drawn.
 *
 * Reads and writes go through the LookupsClient: Backend's lookup contract when it answers, the fixture
 * (edits kept in this browser) when it does not.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Add / rename pop-up: English | Traditional Chinese side by side, Simplified Chinese below (FormGrid); delete confirm stays one column.
 */

import { useState, type FormEvent } from 'react';
import { HintRow } from '../components/FinanceBits.tsx';
import { FormGrid, SPAN } from '../components/FormGrid.tsx';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { Table } from '../components/Table.tsx';
import { LIST_REGISTRY, VISITOR_PURPOSE, canDeactivate, canDelete, orderedItems, type LookupItem, type LookupLabels } from '../lookups/lookup-lists.ts';
import { LookupError, lookupsClient, useLookupItems } from '../lookups/lookups-client.ts';
import { purposeUsage } from '../lookups/purpose-view.ts';
import { useDeskVisits } from './desk-visits.ts';

const fill = (tpl: string, vars: Record<string, string | number>) => tpl.replace(/\{(\w+)\}/g, (_, k: string) => String(vars[k] ?? ''));

type Dialog = { kind: 'add' } | { kind: 'rename'; item: LookupItem } | { kind: 'delete'; item: LookupItem };

const EMPTY: LookupLabels = { en: '', 'zh-Hant': '', 'zh-Hans': '' };

export function AdminListsScreen({ locale }: { locale: Locale }) {
  const M = MESSAGES.lookups;
  const wired = LIST_REGISTRY.filter((d) => d.wired);
  const waiting = LIST_REGISTRY.filter((d) => !d.wired);
  const nameOf = (key: string) => t(key === VISITOR_PURPOSE ? M.visitorPurpose : key === 'case_type' ? M.caseTypes : M.helpdeskCategories, locale);
  const [listKey, setListKey] = useState(wired[0]?.listKey ?? VISITOR_PURPOSE);
  const client = lookupsClient();
  const items = orderedItems(useLookupItems(listKey));
  const desk = useDeskVisits().visits;
  // What the page can count: today's visits (and the design demo rows on the fixture). Backend knows the rest and says so on a refused delete.
  const usage = listKey === VISITOR_PURPOSE ? purposeUsage(desk, items, client.kind === 'fixture') : {};
  const [refused, setRefused] = useState<Record<string, number>>({});
  const [dialog, setDialog] = useState<Dialog | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const active = items.filter((i) => i.active).length;
  const live = client.kind === 'live';
  const movable = items.filter((i) => !i.isSystem);

  const columns = [
    { key: 'order', label: t(M.colOrder, locale), width: '14%' },
    { key: 'type', label: t(M.colType, locale), width: '34%' },
    { key: 'records', label: t(M.colRecords, locale), width: '16%' },
    { key: 'actions', label: t(M.colActions, locale), width: '36%' },
  ];

  /** One failure message per kind of refusal; the page stays as it was. */
  function failure(err: unknown, name: string): string {
    if (err instanceof LookupError) {
      if (err.kind === 'lookup-label-exists') return t(M.labelExists, locale);
      if (err.kind === 'lookup-code-in-use') {
        if (err.inUseCount === 1) return fill(t(M.deleteInUseOne, locale), { name });
        if (err.inUseCount !== null) return fill(t(M.deleteInUse, locale), { name, n: err.inUseCount });
        return fill(t(M.deleteInUseNoCount, locale), { name });
      }
      if (err.kind === 'offline') return t(M.saveOffline, locale);
    }
    return t(M.saveFailed, locale);
  }

  return (
    <div data-testid="admin-lists">
      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.listsLabel, locale)}</h2>
        <HintRow text={t(M.intro, locale)} />
        {wired.length > 1 ? (
          <div className="pemo-tabs" role="tablist" aria-label={t(M.listsLabel, locale)}>
            {wired.map((d) => (
              <button key={d.listKey} type="button" role="tab" aria-selected={listKey === d.listKey} className="pemo-tab" data-tree-chrome="true" data-testid={`lists-tab-${d.listKey}`} onClick={() => setListKey(d.listKey)}>
                {nameOf(d.listKey)}
              </button>
            ))}
          </div>
        ) : (
          <h3 className="pemo-panel__title" style={{ marginTop: 'var(--pemo-space-4)' }} data-testid="lists-current">{nameOf(listKey)}</h3>
        )}
        {waiting.length > 0 ? (
          <HintRow text={t(M.comingNote, locale)} testId="lists-coming" />
        ) : null}

        <div className="pemo-toolbar" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="pemo-meta" data-testid="lists-counts">{fill(t(M.counts, locale), { active, inactive: items.length - active })}</span>
          <button type="button" className="pemo-button pemo-button--primary" data-tree-chrome="true" data-testid="lists-add" onClick={() => setDialog({ kind: 'add' })}>
            {t(M.add, locale)}
          </button>
        </div>

        <div role="status" aria-live="polite" data-testid="lists-status">
          {notice ? <p className="pemo-note" data-testid="lists-notice">{notice}</p> : null}
        </div>

        <Table caption={nameOf(listKey)} columns={columns} testId="lists-table">
          {items.map((it) => {
            const label = it.labels[locale];
            const used = Math.max(usage[it.code] ?? 0, refused[it.code] ?? 0);
            const slot = movable.findIndex((x) => x.code === it.code);
            const canUp = slot > 0;
            const canDown = slot >= 0 && slot < movable.length - 1;
            const recordsText = used > 0
              ? (live && !refused[it.code] ? fill(t(M.usedToday, locale), { n: used }) : refused[it.code] && !usage[it.code] ? t(M.inUse, locale) : used === 1 ? t(M.usedByOne, locale) : fill(t(M.usedBy, locale), { n: used }))
              : live ? '—' : t(M.notUsed, locale);
            return (
              <tr key={it.code} data-testid="lists-row" data-active={it.active} data-used={used > 0} data-system={it.isSystem}>
                <td>
                  {/* An arrow that cannot move the type is not drawn; a spacer keeps the pair aligned. */}
                  {canUp
                    ? <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="lists-up" aria-label={fill(t(M.moveUp, locale), { name: label })} onClick={() => void client.move(listKey, it.code, -1).catch((e: unknown) => setNotice(failure(e, label)))}>▲</button>
                    : <span style={{ display: 'inline-block', width: 40 }} aria-hidden="true" />}{' '}
                  {canDown
                    ? <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="lists-down" aria-label={fill(t(M.moveDown, locale), { name: label })} onClick={() => void client.move(listKey, it.code, 1).catch((e: unknown) => setNotice(failure(e, label)))}>▼</button>
                    : null}
                </td>
                <td>
                  <span style={{ fontWeight: 600, ...(it.active ? {} : { color: 'var(--pemo-neutral-500)' }) }} data-testid="lists-name">{label}</span>
                  {it.active ? null : <> <span className="pemo-tag" data-testid="lists-inactive-tag">{t(M.inactiveTag, locale)}</span></>}
                  <div className="pemo-meta">{[...new Set([it.labels.en, it.labels['zh-Hant'], it.labels['zh-Hans']])].filter((x) => x !== label).join(' · ')}</div>
                </td>
                <td data-testid="lists-records">{used > 0 || live ? recordsText : <span className="pemo-meta">{recordsText}</span>}</td>
                <td>
                  <div className="pemo-toolbar" style={{ margin: 0 }}>
                    <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="lists-rename" onClick={() => setDialog({ kind: 'rename', item: it })}>{t(M.rename, locale)}</button>
                    {canDeactivate(it) || !it.active ? (
                      <button
                        type="button"
                        className="pemo-button"
                        data-tree-chrome="true"
                        data-testid={it.active ? 'lists-deactivate' : 'lists-reactivate'}
                        onClick={() => {
                          const turningOff = it.active;
                          void client.update(listKey, it.code, { active: !turningOff }).then(
                            () => setNotice(fill(t(turningOff ? M.savedOff : M.savedOn, locale), { name: label })),
                            (e: unknown) => setNotice(failure(e, label)),
                          );
                        }}
                      >
                        {t(it.active ? M.deactivate : M.reactivate, locale)}
                      </button>
                    ) : null}
                    {canDelete(it, used) ? (
                      <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="lists-delete" onClick={() => setDialog({ kind: 'delete', item: it })}>{t(M.remove, locale)}</button>
                    ) : null}
                  </div>
                </td>
              </tr>
            );
          })}
        </Table>
      </section>

      {dialog ? (
        <TypeDialog
          dialog={dialog}
          locale={locale}
          onClose={() => setDialog(null)}
          onSave={async (labels) => {
            try {
              if (dialog.kind === 'add') {
                const made = await client.create(listKey, labels);
                setNotice(fill(t(M.savedAdd, locale), { name: made.labels[locale] }));
              } else if (dialog.kind === 'rename') {
                const done = await client.update(listKey, dialog.item.code, { labels });
                setNotice(fill(t(M.savedRename, locale), { name: done.labels[locale] }));
              }
              setDialog(null);
              return null;
            } catch (err) {
              return failure(err, labels[locale]);
            }
          }}
          onDelete={async () => {
            if (dialog.kind !== 'delete') return;
            const name = dialog.item.labels[locale];
            try {
              await client.remove(listKey, dialog.item.code, Math.max(usage[dialog.item.code] ?? 0, refused[dialog.item.code] ?? 0));
              setNotice(fill(t(M.savedDelete, locale), { name }));
            } catch (err) {
              // Backend knows the records the page cannot see: remember the count so Delete stays hidden.
              if (err instanceof LookupError && err.kind === 'lookup-code-in-use') setRefused({ ...refused, [dialog.item.code]: err.inUseCount ?? 1 });
              setNotice(failure(err, name));
            }
            setDialog(null);
          }}
        />
      ) : null}
    </div>
  );
}

function TypeDialog({ dialog, locale, onClose, onSave, onDelete }: {
  dialog: Dialog;
  locale: Locale;
  onClose: () => void;
  /** Resolves to a message when the change was refused, null when it was saved. */
  onSave: (labels: LookupLabels) => Promise<string | null>;
  onDelete: () => Promise<void>;
}) {
  const M = MESSAGES.lookups;
  const [labels, setLabels] = useState<LookupLabels>(dialog.kind === 'rename' ? { ...dialog.item.labels } : EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const set = (k: keyof LookupLabels, v: string) => { setLabels({ ...labels, [k]: v }); setError(null); };
  const submit = async (e: FormEvent) => {
    e.preventDefault();
    if (busy) return;
    if (!labels.en.trim() || !labels['zh-Hant'].trim() || !labels['zh-Hans'].trim()) { setError(t(M.labelsRequired, locale)); return; }
    setBusy(true);
    const refusal = await onSave(labels);
    setBusy(false);
    if (refusal) setError(refusal);
  };
  const title = dialog.kind === 'add' ? M.dialogAdd : dialog.kind === 'rename' ? M.dialogRename : M.deleteTitle;
  return (
    <div className="pemo-dialog-scrim" data-testid="lists-dialog-scrim">
      <div className={dialog.kind === 'delete' ? 'pemo-dialog' : 'pemo-dialog pemo-dialog--form'} role="dialog" aria-modal="true" aria-labelledby="lists-dialog-title" data-testid="lists-dialog" data-kind={dialog.kind}>
        <h2 className="pemo-panel__title" id="lists-dialog-title">{t(title, locale)}</h2>
        {dialog.kind === 'delete' ? (
          <>
            <p className="pemo-note">{fill(t(M.deleteBody, locale), { name: dialog.item.labels[locale] })}</p>
            <div className="pemo-dialog__actions">
              <button type="button" className="pemo-button" data-tree-chrome="true" data-testid="lists-dialog-cancel" onClick={onClose}>{t(M.cancel, locale)}</button>
              <button type="button" className="pemo-button pemo-button--primary" data-tree-chrome="true" data-testid="lists-dialog-confirm" onClick={() => void onDelete()}>{t(M.remove, locale)}</button>
            </div>
          </>
        ) : (
          <form data-form-act="saveLookupType" onSubmit={(e) => void submit(e)} noValidate>
            <FormGrid>
            <div className={SPAN}><HintRow text={t(M.dialogHint, locale)} /></div>
            {([['en', M.labelEn], ['zh-Hant', M.labelHant], ['zh-Hans', M.labelHans]] as const).map(([k, label]) => (
              <label key={k} className="pemo-field" htmlFor={`lists-label-${k}`}>
                {t(label, locale)}
                <input id={`lists-label-${k}`} autoComplete="off" lang={k} value={labels[k]} data-form-field="true" data-testid={`lists-label-${k}`} onChange={(e) => set(k, e.target.value)} />
              </label>
            ))}
            {error ? <p className={`pemo-note pemo-note--error ${SPAN}`} role="alert" data-testid="lists-dialog-error">{error}</p> : null}
            </FormGrid>
            <div className="pemo-dialog__actions">
              <button type="button" className="pemo-button" data-form-field="true" data-testid="lists-dialog-cancel" onClick={onClose}>{t(M.cancel, locale)}</button>
              <button type="submit" className="pemo-button pemo-button--primary" data-form-field="true" data-testid="lists-dialog-save">{t(M.save, locale)}</button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
