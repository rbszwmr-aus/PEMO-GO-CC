/**
 * Chart: inline-SVG donut, bar and line charts. No chart library (the runtime stays react + react-dom).
 * Every segment, bar and point can drill (`onPick`); keyboard: the legend rows (donut) or arrow keys on the
 * series (bars / line, one tab stop). Colours come from tokens through `data-chart-tone` (see base.css).
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) DonutChart, SeriesChart (bars or line); axis maths in chart-math.ts.
 */

import { useEffect, useRef, useState, type KeyboardEvent } from 'react';
import { Icon } from './Icon.tsx';
import { niceMax } from './chart-math.ts';
import { number } from '../format/datetime.ts';
import type { Locale } from '../i18n/locale.ts';

export type ChartTone = 'primary' | 'soft' | 'attention' | 'critical' | 'neutral';

export type DonutDatum = { key: string; label: string; value: number; tone: ChartTone; onPick?: (() => void) | undefined };

const R = 48;
const C = 2 * Math.PI * R;

export function DonutChart({ data, totalLabel, ariaLabel, locale, testId }: {
  data: readonly DonutDatum[];
  totalLabel: string;
  ariaLabel: string;
  locale: Locale;
  testId: string;
}) {
  const total = data.reduce((s, d) => s + d.value, 0);
  let offset = 0;
  return (
    <div className="pemo-donut" data-testid={testId}>
      <svg viewBox="0 0 120 120" role="img" aria-label={ariaLabel}>
        <circle className="pemo-donut__track" cx="60" cy="60" r={R} />
        {total > 0
          ? data.filter((d) => d.value > 0).map((d) => {
            const len = (C * d.value) / total;
            const seg = (
              <circle
                key={d.key}
                className="pemo-donut__seg"
                data-chart-tone={d.tone}
                data-pick={d.onPick ? 'true' : undefined}
                data-testid={`${testId}-seg`}
                data-seg={d.key}
                cx="60"
                cy="60"
                r={R}
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-offset}
                transform="rotate(-90 60 60)"
                onClick={d.onPick}
              >
                <title>{`${d.label}: ${number(d.value, locale)}`}</title>
              </circle>
            );
            offset += len;
            return seg;
          })
          : null}
        <text x="60" y="61" className="pemo-donut__total" textAnchor="middle">{number(total, locale)}</text>
        <text x="60" y="76" className="pemo-donut__caption" textAnchor="middle">{totalLabel}</text>
      </svg>
      <ul className="pemo-chart__legend">
        {data.map((d) => {
          const body = (
            <>
              <i className="pemo-chart__swatch" data-chart-tone={d.tone} aria-hidden="true" />
              <span className="pemo-chart__legend-label">{d.label}</span>
              <b className="pemo-chart__legend-value">{number(d.value, locale)}</b>
              {d.onPick ? <Icon name="ChevronRight" size={14} /> : null}
            </>
          );
          return (
            <li key={d.key}>
              {d.onPick ? (
                <button type="button" className="pemo-chart__legend-row" data-testid={`${testId}-legend`} data-seg={d.key} data-tree-chrome="true" onClick={d.onPick}>{body}</button>
              ) : (
                <span className="pemo-chart__legend-row">{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export type SeriesDatum = {
  key: string;
  /** Full label for the readout and the accessible name, e.g. "Thu 12 Nov". */
  label: string;
  /** Short x-axis label, shown on the first, middle and last point. */
  tick: string;
  value: number;
  onPick?: (() => void) | undefined;
};

const H = 190;
const PAD = { l: 30, r: 10, t: 10, b: 24 };

export function SeriesChart({ kind, data, ariaLabel, totalLabel, locale, testId }: {
  kind: 'bars' | 'line';
  data: readonly SeriesDatum[];
  ariaLabel: string;
  /** Shown beside the sum while nothing is hovered or focused. */
  totalLabel: string;
  locale: Locale;
  testId: string;
}) {
  const wrap = useRef<HTMLDivElement>(null);
  // Draw in real pixels (not a scaled viewBox) so axis text stays the same size at every panel width.
  const [W, setW] = useState(520);
  useEffect(() => {
    const el = wrap.current;
    if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => { if (e) setW(Math.max(260, Math.round(e.contentRect.width))); });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const [active, setActive] = useState<number | null>(null);
  const [tab, setTab] = useState(0);
  const refs = useRef<(SVGGElement | null)[]>([]);
  const n = data.length;
  const yMax = niceMax(Math.max(0, ...data.map((d) => d.value)));
  const plotW = W - PAD.l - PAD.r;
  const plotH = H - PAD.t - PAD.b;
  const x = (i: number) => PAD.l + (n === 1 ? plotW / 2 : (plotW * (i + 0.5)) / n);
  const y = (v: number) => PAD.t + plotH - (plotH * v) / yMax;
  const sum = data.reduce((s, d) => s + d.value, 0);
  const band = plotW / Math.max(n, 1);

  const onKeyDown = (e: KeyboardEvent<SVGSVGElement>) => {
    const next = e.key === 'ArrowRight' ? Math.min(n - 1, tab + 1) : e.key === 'ArrowLeft' ? Math.max(0, tab - 1) : e.key === 'Home' ? 0 : e.key === 'End' ? n - 1 : null;
    if (next === null) return;
    e.preventDefault();
    setTab(next);
    refs.current[next]?.focus();
  };

  const points = data.map((d, i) => `${x(i)},${y(d.value)}`).join(' ');
  const showTick = (i: number) => i === 0 || i === n - 1 || i === Math.floor((n - 1) / 2);
  const readout = active === null ? `${totalLabel} ${number(sum, locale)}` : `${data[active]!.label} · ${number(data[active]!.value, locale)}`;

  return (
    <div ref={wrap} className="pemo-series" data-testid={testId} data-kind={kind}>
      <svg viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="group" aria-label={ariaLabel} onKeyDown={onKeyDown}>
        {[0, yMax / 2, yMax].map((v) => (
          <g key={v}>
            <line className="pemo-series__grid" x1={PAD.l} x2={W - PAD.r} y1={y(v)} y2={y(v)} />
            <text className="pemo-series__axis" x={PAD.l - 6} y={y(v) + 4} textAnchor="end">{number(v, locale)}</text>
          </g>
        ))}
        {kind === 'line' && n > 1 ? (
          <>
            <polygon className="pemo-series__area" points={`${x(0)},${y(0)} ${points} ${x(n - 1)},${y(0)}`} />
            <polyline className="pemo-series__line" points={points} />
          </>
        ) : null}
        {data.map((d, i) => (
          <g
            key={d.key}
            ref={(el) => { refs.current[i] = el; }}
            className="pemo-series__item"
            role="button"
            tabIndex={i === tab ? 0 : -1}
            aria-label={`${d.label}: ${number(d.value, locale)}`}
            data-testid={`${testId}-item`}
            data-pick={d.onPick ? 'true' : undefined}
            data-key={d.key}
            data-tree-chrome="true"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            onFocus={() => { setActive(i); setTab(i); }}
            onBlur={() => setActive(null)}
            onClick={d.onPick}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && d.onPick) { e.preventDefault(); d.onPick(); } }}
          >
            <rect className="pemo-series__hit" x={x(i) - band / 2} y={PAD.t} width={band} height={plotH} />
            {kind === 'bars' ? (
              <rect
                className="pemo-series__bar"
                x={x(i) - Math.max(2, band * 0.3)}
                width={Math.max(4, band * 0.6)}
                y={y(d.value)}
                height={Math.max(d.value > 0 ? 2 : 0, plotH - (y(d.value) - PAD.t))}
                rx="2"
              />
            ) : (
              <circle className="pemo-series__dot" cx={x(i)} cy={y(d.value)} r={active === i ? 5 : 3.5} />
            )}
            {showTick(i) ? <text className="pemo-series__axis" x={x(i)} y={H - 6} textAnchor={i === 0 ? 'start' : i === n - 1 ? 'end' : 'middle'}>{d.tick}</text> : null}
          </g>
        ))}
      </svg>
      <output className="pemo-series__readout" data-testid={`${testId}-readout`}>{readout}</output>
    </div>
  );
}
