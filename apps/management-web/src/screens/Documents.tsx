/**
 * Documents — COMMUNICATE leaf (list → detail), fixture-first.
 *
 * Circulars, house rules and a fee-schedule PDF stub for Wing Fu Garden.
 * No listDocuments / getDocument in the management contract under v0 freeze.
 * SCOPE rail filters rows that already carry a place. Uploads stay named
 * under DeferredActions.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Status tabs are CardTabItem, so every tab that can become a stat card carries an icon (type-level).
 */

import { HintRow, ITDetails } from '../components/FinanceBits.tsx';
import { useMemo, useState } from 'react';

import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { dateOnly, number } from '../format/datetime.ts';
import { PlainChip } from '../components/SeverityChip.tsx';
import { ScopePathCell } from '../components/ScopePathCell.tsx';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { FilterBar, type FilterDef } from '../components/TableControls.tsx';
import type { ViewSpec } from '../components/table-view.ts';
import type { TabItem } from '../components/Tabs.tsx';
import { StatusHead, useStatusView, type CardTabItem, type StatusDef } from '../components/StatusList.tsx';
import { DeferredActions } from '../components/DeferredActions.tsx';
import {
  DOCUMENT_DETAIL_DEFAULT,
  DOCUMENT_KINDS,
  DOCUMENT_ROWS,
  DOCUMENT_STATUSES,
  findDocument,
  type DocumentKind,
  type DocumentRow,
  type DocumentStatus,
} from '../data/documents-corpus.ts';
import { scopePathInFocus } from '../shell/scope-focus.ts';
import type { NodeKey } from './tree-collapse.ts';

const m = copy;

const LIST_DEFERRED = [
  m('Upload a document', '上載文件', '上传文件'),
  m('Replace a PDF', '更換 PDF', '更换 PDF'),
];

function kindLabel(kind: DocumentKind, locale: Locale): string {
  return t(MESSAGES.documents.kind[kind], locale);
}

function statusLabel(status: DocumentStatus, locale: Locale): string {
  return t(MESSAGES.documents.status[status], locale);
}

type DocumentTab = 'all' | DocumentKind;
/** All, then each kind; every tab opens newest first. Status (current, superseded) is a dropdown beside the search. */
const STATUSES: readonly StatusDef<DocumentRow, DocumentTab>[] = (['all', 'circular', 'house_rules', 'fee_schedule'] as DocumentTab[]).map((id) => ({
  id,
  test: (d: DocumentRow) => id === 'all' || d.kind === id,
  sort: { key: 'published', dir: 'desc' } as const,
}));
const SEARCH = copy('Search title or place', '搜尋標題或地點', '搜索标题或地点');

export function DocumentsList({
  locale,
  onOpen,
  focusKey,
  empty,
}: {
  locale: Locale;
  onOpen: (documentId: string) => void;
  focusKey?: NodeKey | null;
  empty?: boolean;
}) {
  const M = MESSAGES.documents;
  const source = empty ? [] : DOCUMENT_ROWS;
  const scoped = focusKey
    ? source.filter((d) => scopePathInFocus(d.scope, focusKey))
    : source;
  const spec = useMemo<ViewSpec<DocumentRow>>(() => ({
    searchText: (d) => `${t(d.title, locale)} ${t(d.placeSummary, locale)}`,
    filters: { status: (d) => d.status },
    sorts: {
      title: (d) => t(d.title, locale),
      kind: (d) => kindLabel(d.kind, locale),
      status: (d) => statusLabel(d.status, locale),
      published: (d) => d.publishedOn,
      place: (d) => t(d.placeSummary, locale),
    },
  }), [locale]);
  const sv = useStatusView(scoped, STATUSES, spec, locale);
  const { tv } = sv;
  const tabs: CardTabItem<DocumentTab>[] = [
    { id: 'all', label: t(M.countAll, locale), icon: 'ClipboardList', count: sv.counts.all },
    { id: 'circular', label: t(M.countCircular, locale), icon: 'Send', count: sv.counts.circular },
    { id: 'house_rules', label: t(M.countHouseRules, locale), icon: 'FileCheck', count: sv.counts.house_rules },
    { id: 'fee_schedule', label: t(M.countFeeSchedule, locale), icon: 'Coins', count: sv.counts.fee_schedule },
  ];
  const filters: FilterDef[] = [
    {
      key: 'status', label: t(M.filterStatus, locale), allLabel: t(M.filterAll, locale),
      options: DOCUMENT_STATUSES.map((s) => ({ value: s, label: statusLabel(s, locale) })),
      value: tv.state.filters['status'] ?? '', onChange: (v) => tv.setFilter('status', v),
    },
  ];

  const columns = [
    { key: 'title', label: t(M.colTitle, locale), width: '30%', sortable: true },
    { key: 'kind', label: t(M.colKind, locale), width: '17%', sortable: true },
    { key: 'status', label: t(M.colStatus, locale), width: '18%', sortable: true },
    { key: 'published', label: t(M.colPublished, locale), width: '15%', sortable: true },
    { key: 'place', label: t(M.colPlace, locale), width: '20%', hideBelow: 640, sortable: true },
  ];

  return (
    <>
      {focusKey ? (
        <p className="pemo-note" data-testid="scope-filter-note" data-screen="documents">
          {t(MESSAGES.shell.filterNote, locale)}
        </p>
      ) : null}
      <HintRow text={t(M.boundaryNote, locale)} />
      <HintRow text={t(M.fixtureLabel, locale)} testId="documents-fixture-label" />
      <StatusHead
        tabs={tabs}
        cardIds={['circular', 'house_rules', 'fee_schedule']}
        filter={sv.filter}
        onChoose={sv.choose}
        onPress={sv.press}
        shown={tv.view.length}
        total={scoped.length}
        locale={locale}
        root="document-status"
        ariaLabel={t(M.countsHeading, locale)}
        cardsTestId="document-stats"
      />

      <section className="pemo-panel" data-testid="documents-filters">
        <FilterBar
          locale={locale}
          testId="documents-bar"
          searchLabel={t(SEARCH, locale)}
          query={tv.state.query}
          onQuery={tv.setQuery}
          filters={filters}
          active={tv.active}
          onClear={tv.clear}
        />
        <HintRow text={t(M.filterNote, locale)} testId="documents-filter-note" />
      </section>

      {tv.view.length === 0 ? (
        <section className="pemo-state" data-testid="state-empty" role="status">
          <h2 className="pemo-state__title">{t(M.emptyTitle, locale)}</h2>
          <p className="pemo-state__body">{t(empty ? M.emptyBody : M.filterNoMatch, locale)}</p>
        </section>
      ) : (
        <section className="pemo-panel">
          <Table caption={t(M.listTitle, locale)} columns={columns} testId="documents-table" sorting={{ sort: tv.state.sort, onSort: tv.onSort }}>
            {tv.view.map((d) => {
              const title = t(d.title, locale);
              const kind = kindLabel(d.kind, locale);
              const status = statusLabel(d.status, locale);
              const published = dateOnly(d.publishedOn, locale);
              return (
                <tr
                  key={d.documentId}
                  data-testid="documents-row"
                  data-document-id={d.documentId}
                  data-kind={d.kind}
                  data-status={d.status}
                  style={{ cursor: 'pointer' }}
                  onClick={() => onOpen(d.documentId)}
                >
                  <WrapCell title={title}>
                    <a
                      href={`?screen=documentsDetail&state=detail&lang=${locale}&document=${encodeURIComponent(d.documentId)}`}
                      data-testid="document-open"
                      data-read-affordance="navigate"
                      onClick={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        onOpen(d.documentId);
                      }}
                    >
                      {title}
                    </a>
                  </WrapCell>
                  <DenseCell title={kind}>{kind}</DenseCell>
                  <td><PlainChip testId="document-status">{status}</PlainChip></td>
                  <DenseCell title={published}>{published}</DenseCell>
                  <td>
                    <ScopePathCell scope={d.scope} locale={locale} short />
                  </td>
                </tr>
              );
            })}
          </Table>
        </section>
      )}

      <DeferredActions locale={locale} actions={LIST_DEFERRED} />
    </>
  );
}

export function DocumentsDetail({
  documentId,
  locale,
  onBack,
  onOpenNotice,
}: {
  documentId: string;
  locale: Locale;
  onBack: () => void;
  onOpenNotice?: ((noticeId: string) => void) | undefined;
}) {
  const M = MESSAGES.documents;
  const row = documentId ? findDocument(documentId) : DOCUMENT_DETAIL_DEFAULT;

  if (!row) {
    return (
      <section className="pemo-panel" data-testid="documents-detail-missing">
        <p>{t(M.notFound, locale)}</p>
        <a
          href={`?screen=documents&state=list&lang=${locale}`}
          data-testid="document-back"
          data-read-affordance="navigate"
          onClick={(e) => {
            e.preventDefault();
            onBack();
          }}
        >
          {t(M.backToList, locale)}
        </a>
      </section>
    );
  }

  return (
    <>
      <section className="pemo-panel" data-testid="documents-detail" data-document-id={row.documentId}>
        <h2 className="pemo-panel__title">{t(row.title, locale)}</h2>
        <PlainChip testId="document-status">{statusLabel(row.status, locale)}</PlainChip>
        <p>
          <a
            href={`?screen=documents&state=list&lang=${locale}`}
            data-testid="document-back"
            data-read-affordance="navigate"
            onClick={(e) => {
              e.preventDefault();
              onBack();
            }}
          >
            {t(M.backToList, locale)}
          </a>
        </p>
        <dl className="pemo-dl" data-testid="document-facts" style={{ marginTop: 'var(--pemo-space-4)' }}>
          <dt>{t(M.colKind, locale)}</dt>
          <dd data-testid="document-kind">{kindLabel(row.kind, locale)}</dd>
          <dt>{t(M.colPublished, locale)}</dt>
          <dd>{dateOnly(row.publishedOn, locale)}</dd>
          <dt>{t(M.colPlace, locale)}</dt>
          <dd><ScopePathCell scope={row.scope} locale={locale} /></dd>
          {row.relatedNoticeId && onOpenNotice ? (
            <>
              <dt>{t(M.relatedNotice, locale)}</dt>
              <dd>
                <a
                  href={`?screen=s5detail&state=detail&lang=${locale}&notice=${encodeURIComponent(row.relatedNoticeId)}`}
                  data-testid="related-notice"
                  data-read-affordance="navigate"
                  onClick={(e) => {
                    e.preventDefault();
                    onOpenNotice(row.relatedNoticeId!);
                  }}
                >
                  {t(M.openRelatedNotice, locale)}
                </a>
              </dd>
            </>
          ) : null}
        </dl>
        <ITDetails locale={locale} testId="document-it-details" rows={[[M.factDocumentId, row.documentId]]} />
        <p className="pemo-note">{t(row.summary, locale)}</p>
        <HintRow text={t(M.fixtureLabel, locale)} testId="documents-fixture-label" />
      </section>

      <section className="pemo-panel" data-testid="document-pdf-stub">
        <h2 className="pemo-panel__title">{t(M.stubHeading, locale)}</h2>
        <HintRow text={t(M.stubNote, locale)} />
        <dl className="pemo-dl" style={{ marginTop: 'var(--pemo-space-3)' }}>
          <dt>{t(M.stubFileName, locale)}</dt>
          <dd><span className="pemo-identifier">{row.stub.fileName}</span></dd>
          <dt>{t(M.stubMime, locale)}</dt>
          <dd>{row.stub.mime}</dd>
          <dt>{t(M.stubPages, locale)}</dt>
          <dd>{number(row.stub.pages, locale)}</dd>
          <dt>{t(M.stubSize, locale)}</dt>
          <dd>{t(row.stub.sizeLabel, locale)}</dd>
        </dl>
      </section>

      <DeferredActions locale={locale} actions={LIST_DEFERRED} />
    </>
  );
}
