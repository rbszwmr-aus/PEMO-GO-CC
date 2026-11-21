/**
 * Facility calendar: Day, Week, Month and Year, one facility at a time or all of them.
 *
 * Single facility (the default, remembered per browser): chips read "time · flat", one tint, at
 * most three a day, then "+N more" (opens Day). All facilities: a colour legend, chips add the
 * facility, and a busy day (more than two bookings) shows per-facility count pills that open Day
 * for that facility. A chip opens the booking as a pop-up; a day number or "+N more" opens Day.
 * Dates come from the Hong Kong clock; the fixture bookings sit in the current month.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) Day / Week / Month / Year, facility select, pills, booking pop-up.
 *   0.1.0 Day / week grid of the fixture week.
 */

import { useMemo, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { bcp47, t, type Locale } from '../i18n/locale.ts';
import { BOOKING_FACILITIES, BOOKING_FIXTURE_TODAY, BOOKING_ROWS, findFacility, findZone, flatOf, type BookingRow } from '../data/booking-fixtures.ts';
import { flatLabel } from '../data/flat-label.ts';
import { browserStorage, CALENDAR_FACILITY_KEY } from '../lookups/lookup-storage.ts';
import { Icon, ICON_SIZE, type IconName } from '../components/Icon.tsx';
import { BOOKING_ICON } from '../data/nav-ia.ts';
import { BookingDialog } from './BookingDialog.tsx';
import { BookingViewTabs } from './Bookings.tsx';
import {
  ALL_FACILITIES, CAL_MODES, DAY_HOURS, cellView, drawn, monthGrid, pillsText, shift, shortFacility, tintOf, weekDays, type CalMode,
} from './calendar-model.ts';

const ORDER = BOOKING_FACILITIES.map((f) => f.facilityId);

function initialFacility(): string {
  const saved = browserStorage().get(CALENDAR_FACILITY_KEY);
  if (saved === ALL_FACILITIES || (saved && ORDER.includes(saved))) return saved;
  return ORDER[0] ?? ALL_FACILITIES;
}

const fmt = (locale: Locale, day: string, o: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat(locale === 'en' ? 'en-GB' : bcp47(locale), { ...o, timeZone: 'Asia/Hong_Kong' }).format(new Date(`${day}T00:00:00+08:00`));

function crumbText(day: string, mode: CalMode, locale: Locale): string {
  if (mode === 'year') return fmt(locale, day, { year: 'numeric' });
  if (mode === 'month') return fmt(locale, day, { year: 'numeric', month: 'long' });
  if (mode === 'day') return fmt(locale, day, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
  const days = weekDays(day);
  return `${fmt(locale, days[0] as string, { day: 'numeric', month: 'short' })} – ${fmt(locale, days[6] as string, { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

const MODE_ICON: Record<'day' | 'week' | 'month' | 'year', IconName> = { day: 'Calendar', week: 'CalendarRange', month: 'CalendarDays', year: 'LayoutGrid' };

export function BookingCalendar({ locale, onView }: { locale: Locale; onView?: (v: 'list' | 'calendar') => void }) {
  const M = MESSAGES.booking;
  const [mode, setMode] = useState<CalMode>('month');
  const [day, setDay] = useState(BOOKING_FIXTURE_TODAY);
  const [facility, setFacility] = useState<string>(initialFacility);
  const [openId, setOpenId] = useState<string | null>(null);
  const all = facility === ALL_FACILITIES;

  const rows = useMemo(() => drawn(BOOKING_ROWS), []);
  const nameOf = (id: string) => {
    const f = findFacility(id);
    return f ? t(f.name, locale) : id;
  };
  const shortOf = (id: string) => shortFacility(id, locale, nameOf(id));
  const open = (id: string) => setOpenId(id);
  const pickFacility = (v: string) => {
    setFacility(v);
    browserStorage().set(CALENDAR_FACILITY_KEY, v);
  };
  const goDay = (d: string, fac?: string) => {
    if (fac) pickFacility(fac);
    setDay(d);
    setMode('day');
  };
  const modeLabel: Record<CalMode, string> = { day: t(M.viewDay, locale), week: t(M.viewWeek, locale), month: t(M.viewMonth, locale), year: t(M.viewYear, locale) };
  const visible = all ? rows : rows.filter((b) => b.facilityId === facility);

  const chip = (b: BookingRow, withFacility: boolean) => {
    const f = findFacility(b.facilityId);
    const z = f ? findZone(f, b.zoneId) : undefined;
    const flat = flatLabel(flatOf(b), locale);
    const rest = [flat, ...(withFacility ? [shortOf(b.facilityId)] : [])].join(' · ');
    const full = `${b.slotStart}–${b.slotEnd} · ${flat} · ${nameOf(b.facilityId)}${z ? ` · ${t(z.name, locale)}` : ''}`;
    return (
      <a
        key={b.bookingId}
        href={`?screen=bookingsDetail&state=detail&lang=${locale}&booking=${encodeURIComponent(b.bookingId)}`}
        className={`pemo-calchip pemo-calchip--t${all ? tintOf(b.facilityId, ORDER) : 1}`}
        data-testid="calendar-booking"
        data-booking-id={b.bookingId}
        data-facility-id={b.facilityId}
        data-read-affordance="navigate"
        title={full}
        onClick={(e) => { e.preventDefault(); open(b.bookingId); }}
      >
        <span className="pemo-calchip__t">{b.slotStart}</span>{' · '}{rest}
      </a>
    );
  };

  const cellBody = (d: string) => {
    const dayRows = visible.filter((b) => b.date === d);
    const v = cellView(dayRows, facility, ORDER);
    if (v.kind === 'chips') {
      return (
        <>
          {v.chips.map((b) => chip(b, all))}
          {v.more > 0 ? (
            <button type="button" className="pemo-calmore" data-tree-chrome="true" data-testid="calendar-more" data-date={d} onClick={() => goDay(d)}>
              {t(M.moreLink, locale).replace('{n}', String(v.more))}
            </button>
          ) : null}
        </>
      );
    }
    const text = pillsText(v.pills, shortOf);
    return (
      <div className="pemo-calpills" data-testid="calendar-pills" data-date={d} title={text}>
        {v.pills.map((p) => (
          <button
            key={p.facilityId}
            type="button"
            className={`pemo-calpill pemo-calchip--t${tintOf(p.facilityId, ORDER)}`}
            data-tree-chrome="true"
            data-testid="calendar-pill"
            data-facility-id={p.facilityId}
            data-count={p.count}
            title={`${nameOf(p.facilityId)} · ${p.count}`}
            onClick={() => goDay(d, p.facilityId)}
          >
            {shortOf(p.facilityId)} {p.count}
          </button>
        ))}
      </div>
    );
  };

  const wd = weekDays(day);
  const weekdayHead = (d: string) => fmt(locale, d, { weekday: 'short' });
  const dayHead = (d: string) => (locale === 'en' ? `${fmt(locale, d, { weekday: 'short' })} ${fmt(locale, d, { day: 'numeric' })}` : `${fmt(locale, d, { day: 'numeric' })} ${fmt(locale, d, { weekday: 'short' })}`);

  return (
    <>
      <BookingViewTabs active="calendar" locale={locale} onChange={(v) => onView?.(v)} />
      <section className="pemo-panel" data-testid="booking-calendar" data-mode={mode} data-facility={facility}>
        <h2 className="pemo-panel__title"><Icon name={BOOKING_ICON.calendar} size={ICON_SIZE.leading} />{' '}{t(M.calendarHeading, locale)}</h2>
        <div className="pemo-toolbar pemo-calbar">
          <div className="pemo-calnav" role="group" aria-label={t(M.navLabel, locale)}>
            <button type="button" className="pemo-button" data-read-affordance="navigate" data-testid="calendar-prev" aria-label={t(M.navPrev, locale)} onClick={() => setDay(shift(day, mode, -1))}><Icon name="ChevronLeft" size={ICON_SIZE.control} /></button>
            <button type="button" className="pemo-button" data-read-affordance="navigate" data-testid="calendar-today" onClick={() => setDay(BOOKING_FIXTURE_TODAY)}><Icon name="CalendarCheck" size={ICON_SIZE.control} /> {t(M.navToday, locale)}</button>
            <button type="button" className="pemo-button" data-read-affordance="navigate" data-testid="calendar-next" aria-label={t(M.navNext, locale)} onClick={() => setDay(shift(day, mode, 1))}><Icon name="ChevronRight" size={ICON_SIZE.control} /></button>
          </div>
          <strong className="pemo-calcrumb" role="status" aria-label={t(M.crumbLabel, locale)} data-testid="calendar-crumb">{crumbText(day, mode, locale)}</strong>
          <div className="pemo-calmodes" role="group" aria-label={t(M.viewsLabel, locale)}>
            {CAL_MODES.map((k) => (
              <button
                key={k}
                type="button"
                className="pemo-button"
                data-testid={`calendar-mode-${k}`}
                data-read-affordance="filter"
                aria-pressed={mode === k}
                onClick={() => setMode(k)}
              >
                <Icon name={MODE_ICON[k]} size={ICON_SIZE.control} /> <span>{modeLabel[k]}</span>
              </button>
            ))}
          </div>
        </div>
        <div className="pemo-toolbar pemo-calbar">
          <label className="pemo-field pemo-field--icon" title={t(M.facilityPick, locale)}>
            <Icon name="Building2" size={ICON_SIZE.control} />
            <select aria-label={t(M.facilityPick, locale)} data-testid="calendar-facility" data-read-affordance="filter" value={facility} onChange={(e) => pickFacility(e.target.value)}>
              {BOOKING_FACILITIES.map((f) => <option key={f.facilityId} value={f.facilityId}>{t(f.name, locale)}</option>)}
              <option value={ALL_FACILITIES}>{t(M.allFacilities, locale)}</option>
            </select>
          </label>
          <label className="pemo-field pemo-field--icon" title={t(M.datePick, locale)}>
            <Icon name="Calendar" size={ICON_SIZE.control} />
            <input type="date" aria-label={t(M.datePick, locale)} data-testid="calendar-date" data-read-affordance="filter" value={day} onChange={(e) => e.target.value && setDay(e.target.value)} />
          </label>
        </div>
        {all ? (
          <ul className="pemo-callegend" aria-label={t(M.legendLabel, locale)} data-testid="calendar-legend">
            {BOOKING_FACILITIES.map((f) => (
              <li key={f.facilityId} data-facility-id={f.facilityId}>
                <span className={`pemo-calswatch pemo-calchip--t${tintOf(f.facilityId, ORDER)}`} aria-hidden="true" />
                {shortOf(f.facilityId)}
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <section className="pemo-panel">
        {mode === 'month' ? (
          <div className="pemo-table-wrap">
            <table className="pemo-table pemo-calendar-table pemo-calmonth" data-testid="booking-calendar-month">
              <caption className="pemo-visually-hidden">{crumbText(day, mode, locale)}</caption>
              <thead>
                <tr>{wd.map((d) => <th key={d} scope="col">{weekdayHead(d)}</th>)}</tr>
              </thead>
              <tbody>
                {Array.from({ length: 6 }, (_, w) => (
                  <tr key={w}>
                    {monthGrid(day).slice(w * 7, w * 7 + 7).map((d) => (
                      <td key={d} data-testid="calendar-cell" data-date={d} data-outside={d.slice(0, 7) !== day.slice(0, 7) ? 'true' : undefined} data-today={d === BOOKING_FIXTURE_TODAY ? 'true' : undefined}>
                        <button type="button" className="pemo-calday" data-tree-chrome="true" data-testid="calendar-day-open" data-date={d} onClick={() => goDay(d)}>
                          {Number(d.slice(8, 10))}
                        </button>
                        {cellBody(d)}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}

        {mode === 'week' ? (
          <div className="pemo-table-wrap">
            <table className="pemo-table pemo-calendar-table pemo-calweek" data-testid="booking-calendar-week">
              <caption className="pemo-visually-hidden">{crumbText(day, mode, locale)}</caption>
              <thead>
                <tr>{wd.map((d) => <th key={d} scope="col">{dayHead(d)}</th>)}</tr>
              </thead>
              <tbody>
                <tr>
                  {wd.map((d) => (
                    <td key={d} data-testid="calendar-cell" data-date={d} data-today={d === BOOKING_FIXTURE_TODAY ? 'true' : undefined}>
                      {visible.filter((b) => b.date === d).map((b) => chip(b, all))}
                    </td>
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        ) : null}

        {mode === 'day' ? (
          <div className="pemo-table-wrap">
            <table className="pemo-table pemo-calendar-table pemo-calday-grid" data-testid="booking-calendar-day">
              <caption className="pemo-visually-hidden">{crumbText(day, mode, locale)}</caption>
              <thead>
                <tr>
                  <th scope="col" className="pemo-calhour" />
                  {(all ? BOOKING_FACILITIES.map((f) => f.facilityId) : [facility]).map((id) => (
                    <th key={id} scope="col" data-testid="calendar-day-col" data-facility-id={id}>{nameOf(id)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {DAY_HOURS.map((h) => (
                  <tr key={h}>
                    <th scope="row" className="pemo-calhour pemo-num">{String(h).padStart(2, '0')}:00</th>
                    {(all ? ORDER : [facility]).map((id) => (
                      <td key={id} data-testid="calendar-hour-cell" data-hour={h} data-facility-id={id}>
                        {rows.filter((b) => b.date === day && b.facilityId === id && Number(b.slotStart.slice(0, 2)) === h).map((b) => chip(b, false))}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {visible.every((b) => b.date !== day) ? <p className="pemo-note" data-testid="calendar-day-empty">{t(M.allDayEmpty, locale)}</p> : null}
          </div>
        ) : null}

        {mode === 'year' ? (
          <div className="pemo-calyear" data-testid="booking-calendar-year">
            {Array.from({ length: 12 }, (_, i) => {
              const key = `${day.slice(0, 4)}-${String(i + 1).padStart(2, '0')}`;
              const n = visible.filter((b) => b.date.slice(0, 7) === key).length;
              return (
                <button
                  key={key}
                  type="button"
                  className="pemo-calyear__tile"
                  data-tree-chrome="true"
                  data-testid="calendar-year-month"
                  data-month={key}
                  data-count={n}
                  onClick={() => { setDay(`${key}-01`); setMode('month'); }}
                >
                  <strong>{fmt(locale, `${key}-01`, { month: 'long' })}</strong>
                  <span className="pemo-meta">{n === 1 ? t(M.oneBooking, locale) : t(M.nBookings, locale).replace('{n}', String(n))}</span>
                </button>
              );
            })}
          </div>
        ) : null}
      </section>
      {openId ? <BookingDialog bookingId={openId} locale={locale} onClose={() => setOpenId(null)} /> : null}
    </>
  );
}
