/**
 * What the Reports CSV and PDF buttons export: ALWAYS the current view.
 * Cards view = the whole report for the date range (one row per metric).
 * Drill-down = the rows on screen after search and sort, and the button label keeps the row count.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { hktStamp } from '../format/datetime.ts';
import {
  CARDS, METRICS, columnsOf, metricValue, REPORT_ESTATE,
  type DateRange, type MetricDef, type ReportRow, type ReportTab,
} from '../data/reports-fixture.ts';

export interface ExportView {
  title: string;
  estate: string;
  range: string;
  filter: string;
  generatedAt: string;
  head: string[];
  rows: string[][];
  widths?: number[];
  fileBase: string;
}

export const rangeText = (r: DateRange): string => `${r.from} – ${r.to}`;

/** "CSV" on the cards view, "CSV (118 rows)" on a drill-down. */
export function actionLabel(base: 'CSV' | 'PDF', drillCount: number | null, locale: Locale): string {
  return drillCount === null ? base : `${base} (${t(MESSAGES.reports.rows, locale).replace('{n}', String(drillCount))})`;
}

const reportName = (tab: ReportTab, locale: Locale): string =>
  t(tab === 'daily' ? MESSAGES.reports.tabDaily : MESSAGES.reports.tabMgmt, locale);

/** Whole report: one row per metric. */
export function cardsExport(tab: ReportTab, range: DateRange, today: string, now: Date, locale: Locale): ExportView {
  const M = MESSAGES.reports;
  const rows: string[][] = METRICS.map((d) => [
    t(CARDS.find((c) => c.id === d.card)!.title, locale),
    t(d.label, locale),
    t(d.basis === 'current' ? M.basisCurrent : M.basisPeriod, locale),
    metricValue(d, range, today).text,
  ]);
  return {
    title: `${t(M.title, locale)} · ${reportName(tab, locale)}`,
    estate: t(REPORT_ESTATE, locale),
    range: rangeText(range),
    filter: t(M.allMetrics, locale),
    generatedAt: hktStamp(now.toISOString(), locale),
    head: [t(M.colSection, locale), t(M.colMetric, locale), t(M.colBasis, locale), t(M.colValue, locale)],
    rows,
    widths: [2, 4, 2, 2],
    fileBase: `report-${tab}-${range.from}_${range.to}`,
  };
}

/** The filtered rows of one metric, in the order shown. */
export function drillExport(tab: ReportTab, def: MetricDef, shown: readonly ReportRow[], query: string, range: DateRange, now: Date, locale: Locale): ExportView {
  const M = MESSAGES.reports;
  const q = query.trim();
  return {
    title: `${t(M.title, locale)} · ${reportName(tab, locale)} · ${t(CARDS.find((c) => c.id === def.card)!.title, locale)} · ${t(def.label, locale)}`,
    estate: t(REPORT_ESTATE, locale),
    range: rangeText(range),
    filter: `${t(M.metricFilter, locale)}: ${t(def.label, locale)}${q ? ` · ${t(M.searchRows, locale)}: ${q}` : ''} · ${shown.length}`,
    generatedAt: hktStamp(now.toISOString(), locale),
    head: columnsOf(def.kind).map((c) => t(c, locale)),
    rows: shown.map((r) => r.cells),
    fileBase: `report-${tab}-${def.id}-${range.from}_${range.to}`,
  };
}

/** Save text or bytes as a file in the browser. */
export function download(name: string, type: string, data: BlobPart): void {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
