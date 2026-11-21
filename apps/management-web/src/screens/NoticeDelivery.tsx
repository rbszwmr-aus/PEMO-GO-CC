/**
 * Notice delivery panel — channels, schedule, fixture job, print PDF, outbox.
 *
 * Fixture store, not a live notices-delivery API. Email reuses Administration
 * Email SMTP config and household contact emails (same outbox seam as invoices).
 */

import { Icon } from '../components/Icon.tsx';
import { HintRow } from '../components/FinanceBits.tsx';
import { useEffect, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { dateTime } from '../format/datetime.ts';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { PlainChip } from '../components/SeverityChip.tsx';
import type { Problem, StaffNoticeDetail } from '../data/types.ts';
import type { NoticeEmailDeliveryResponse } from '../data/strata-live.ts';
import { ProblemState } from '../components/StateNotice.tsx';
import { noticeScopeFor } from '../data/notices-wfg-corpus.ts';
import {
  NOTICE_DELIVERY_CHANNELS,
  deliveryPlanOf,
  deliveryRowsFor,
  noticeDeliveryDue,
  noticeDeliveryStatus,
  processDueNoticeDeliveries,
  scheduleNoticeDelivery,
  sendNoticeNow,
  subscribeNoticeDeliveries,
  type DeliveryRowStatus,
  type LobbyDisplay,
  type NoticeDeliveryChannel,
  type NoticeDeliveryPlan,
  type NoticeDeliveryRow,
  type NoticeDeliveryStatus,
  type PortalPublish,
} from '../communicate/notice-delivery.ts';
import {
  noticePosterFileName,
  noticePosterPdfDataUrl,
  noticeToPoster,
} from '../communicate/notice-poster.ts';

export function useNoticeDeliveryStore(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeNoticeDeliveries(() => setRevision((n) => n + 1)), []);
  return revision;
}

function scopeLabelOf(noticeId: string, locale: Locale): string {
  const scope = noticeScopeFor(noticeId);
  const label = scope?.node.label ? t(scope.node.label, locale) : undefined;
  return label || 'Wing Fu Garden';
}

export interface LiveNoticeEmail {
  readonly delivery: NoticeEmailDeliveryResponse | null;
  readonly problem: Problem | null;
  readonly pending: boolean;
  readonly onSend: () => void;
  readonly sendNote: string | null;
}

export function NoticeDeliveryPanel({
  notice,
  locale,
  liveEmail,
}: {
  notice: StaffNoticeDetail;
  locale: Locale;
  /** When set, the email channel and its outbox come from the API. Schedule stays unstored (`schedule: null`). */
  liveEmail?: LiveNoticeEmail;
}) {
  const M = MESSAGES.s5;
  useNoticeDeliveryStore();
  const stored = deliveryPlanOf(notice.noticeId);
  const [channels, setChannels] = useState<NoticeDeliveryChannel[]>(stored.channels);
  const [scheduledAt, setScheduledAt] = useState(stored.scheduledAt ?? '');
  const [note, setNote] = useState<'saved' | 'need-channels' | 'need-when' | null>(null);

  useEffect(() => {
    const next = deliveryPlanOf(notice.noticeId);
    setChannels(next.channels);
    setScheduledAt(next.scheduledAt ?? '');
  }, [notice.noticeId, stored.scheduledAt, stored.channels.join('|'), stored.deliveredAt]);

  const plan: NoticeDeliveryPlan = stored;
  const status: NoticeDeliveryStatus = noticeDeliveryStatus(plan);
  const due = noticeDeliveryDue(plan);
  const delivered = status === 'sent_displaying' || status === 'expired';
  const poster = noticeToPoster(notice, {
    scheduledAt: scheduledAt || plan.scheduledAt,
    scopeLabel: scopeLabelOf(notice.noticeId, 'en'),
  });
  const rows: NoticeDeliveryRow[] = liveEmail
    ? (liveEmail.delivery?.email.sends ?? []).map((row) => ({
        rowId: row.outboxId,
        noticeId: notice.noticeId,
        channel: 'email' as const,
        recordedAt: row.recordedAt,
        status: row.status === 'accepted' ? 'sent' : row.status === 'failed' ? 'failed' : 'outbox',
        detail: `${row.to} · ${row.transport} · ${row.detail}`,
        to: row.to,
        subject: row.subject,
        delivery: row.transport === 'smtp' ? 'smtp' as const : 'outbox' as const,
      }))
    : deliveryRowsFor(notice.noticeId);

  const toggle = (channel: NoticeDeliveryChannel) => {
    setNote(null);
    setChannels((cur) =>
      cur.includes(channel) ? cur.filter((c) => c !== channel) : [...cur, channel],
    );
  };

  const formInput = (): { channels: NoticeDeliveryChannel[]; scheduledAt: string } => ({
    channels,
    scheduledAt: scheduledAt.trim(),
  });

  const onSchedule = () => {
    const result = scheduleNoticeDelivery(notice.noticeId, formInput());
    setNote(result.reason ?? 'saved');
  };

  return (
    <>
      <section className="pemo-panel" data-testid="notice-delivery" data-notice-id={notice.noticeId}>
        <h2 className="pemo-panel__title" data-testid="notice-delivery-heading">{t(M.deliveryHeading, locale)}</h2>
        <HintRow text={t(M.deliveryNote, locale)} />
        <HintRow text={t(M.deliveryClockNote, locale)} testId="notice-delivery-clock" />
        {liveEmail ? (
          <p className="pemo-note" data-testid="notice-delivery-live">
            {t({
              en: 'Live email channel. A delivery schedule is not stored (schedule is null). Send records an outbox row on the server.',
              'zh-Hant': '即時電郵渠道。沒有儲存派送時間表（schedule 為 null）。發送會在伺服器記錄寄件匣。', 'zh-Hans': '即时电子邮件渠道。没有保存派送时间表（schedule 为 null）。发送会在服务器记录发件箱。',
            }, locale)}
          </p>
        ) : null}

        <dl className="pemo-dl">
          <dt>{t(M.deliveryStatusLabel, locale)}</dt>
          <dd>
            <PlainChip testId="notice-delivery-status">{t(M.noticeDeliveryStatus[status], locale)}</PlainChip>
            {due ? (
              <span className="pemo-meta" data-testid="notice-delivery-due">
                {' '}
                {t(M.deliveryDueNote, locale)}
              </span>
            ) : null}
          </dd>
          <dt>{t(M.lobbyHeading, locale)}</dt>
          <dd data-testid="lobby-playlist-status" data-display={plan.lobby?.display ?? 'none'}>
            {t(M.lobbyDisplay[(plan.lobby?.display ?? 'none') as LobbyDisplay], locale)}
            {plan.lobby ? (
              <div className="pemo-meta">
                <span className="pemo-identifier">{plan.lobby.playlistId}</span>
                {' · '}
                {plan.lobby.scopeKind}:{plan.lobby.scopeId}
              </div>
            ) : null}
          </dd>
          <dt>{t(M.portalHeading, locale)}</dt>
          <dd data-testid="portal-publish-status" data-portal={plan.portal}>
            {t(M.portalPublish[plan.portal as PortalPublish], locale)}
          </dd>
        </dl>

        <form
          className="pemo-form"
          data-testid="notice-delivery-form"
          data-form-act="scheduleNoticeDelivery"
          onSubmit={(e) => {
            e.preventDefault();
            onSchedule();
          }}
        >
          <fieldset className="pemo-field" data-testid="delivery-channels">
            <legend>{t(M.fieldChannels, locale)}</legend>
            {NOTICE_DELIVERY_CHANNELS.map((channel) => (
              <label key={channel} className="pemo-check" htmlFor={`ndel-${notice.noticeId}-${channel}`}>
                <input
                  id={`ndel-${notice.noticeId}-${channel}`}
                  type="checkbox"
                  name="channels"
                  value={channel}
                  checked={channels.includes(channel)}
                  onChange={() => toggle(channel)}
                  data-testid={`delivery-channel-${channel}`}
                  data-form-field="true"
                />
                {t(M.deliveryChannel[channel], locale)}
              </label>
            ))}
          </fieldset>

          <label className="pemo-field" htmlFor={`ndel-${notice.noticeId}-scheduledAt`}>
            {t(M.fieldDeliveryScheduledAt, locale)}
            <input
              id={`ndel-${notice.noticeId}-scheduledAt`}
              name="scheduledAt"
              data-testid="delivery-scheduled-at"
              data-form-field="true"
              value={scheduledAt}
              placeholder="2026-09-19T09:00:00+08:00"
              onChange={(e) => {
                setScheduledAt(e.target.value);
                setNote(null);
              }}
            />
          </label>

          <div className="pemo-actions">
            <button
              type="submit"
              className="pemo-button pemo-button--primary"
              data-testid="schedule-notice-delivery"
              data-form-field="true"
            >
              {t(M.scheduleDelivery, locale)}
            </button>
            <button
              type="button"
              className="pemo-button"
              data-testid="process-due-notice-deliveries"
              data-read-affordance="fixture"
              onClick={() => { void processDueNoticeDeliveries(); }}
            >
              {t(M.runDueDeliveries, locale)}
            </button>
            <button
              type="button"
              className="pemo-button"
              data-testid="send-notice-now"
              data-read-affordance={liveEmail ? 'live' : 'fixture'}
              disabled={liveEmail ? false : delivered}
              onClick={() => {
                if (liveEmail) liveEmail.onSend();
                else void sendNoticeNow(notice.noticeId, formInput());
              }}
            >
              {t(M.sendNoticeNow, locale)}
            </button>
            <a
              className="pemo-button"
              href={noticePosterPdfDataUrl(poster, locale)}
              download={noticePosterFileName(poster)}
              data-testid="notice-poster-pdf-download"
              data-read-affordance="download"
            >
              {t(M.downloadPosterPdf, locale)}
            </a>
          </div>
        </form>

        {note === 'saved' ? (
          <p className="pemo-note" data-testid="notice-delivery-saved" role="status">{t(M.scheduleSaved, locale)}</p>
        ) : null}
        {note === 'need-channels' ? (
          <p className="pemo-note" data-testid="notice-delivery-need-channels" role="status">{t(M.scheduleNeedChannels, locale)}</p>
        ) : null}
        {note === 'need-when' ? (
          <p className="pemo-note" data-testid="notice-delivery-need-when" role="status">{t(M.scheduleNeedWhen, locale)}</p>
        ) : null}
        {liveEmail?.sendNote ? (
          <p className="pemo-note" data-testid="notice-email-send-result" role="status">{liveEmail.sendNote}</p>
        ) : null}
      </section>

      <section className="pemo-panel" data-testid="notice-delivery-outbox">
        <h2 className="pemo-panel__title">{t(M.deliveryOutboxHeading, locale)}</h2>
        <HintRow text={t(M.deliveryOutboxNote, locale)} />
        {liveEmail?.problem ? <ProblemState problem={liveEmail.problem} locale={locale} /> : null}
        {liveEmail?.pending && !liveEmail.problem ? (
          <p className="pemo-note" data-testid="notice-delivery-pending" role="status">…</p>
        ) : null}
        {liveEmail?.problem || liveEmail?.pending ? null : rows.length === 0 ? (
          <p className="pemo-note" data-testid="notice-delivery-outbox-empty">{t(M.deliveryOutboxNone, locale)}</p>
        ) : (
          <Table
            caption={t(M.deliveryOutboxHeading, locale)}
            columns={[
              { key: 'channel', label: t(M.colDeliveryChannel, locale), width: '16%' },
              { key: 'detail', label: t(M.colDeliveryDetail, locale), width: '38%' },
              { key: 'when', label: t(M.colDeliveryWhen, locale), width: '24%' },
              { key: 'status', label: t(M.colDeliveryRowStatus, locale), width: '22%' },
            ]}
            testId="notice-delivery-outbox-table"
          >
            {rows.map((row) => {
              const when = dateTime(row.recordedAt, locale);
              const channel = t(M.deliveryChannel[row.channel], locale);
              const rowStatusKey: DeliveryRowStatus = row.status;
              const rowStatus = t(M.deliveryRowStatus[rowStatusKey], locale);
              return (
                <tr
                  key={row.rowId}
                  data-testid="notice-delivery-row"
                  data-row-id={row.rowId}
                  data-notice-id={row.noticeId}
                  data-channel={row.channel}
                  data-status={row.status}
                >
                  <DenseCell title={channel}>{channel}</DenseCell>
                  <WrapCell title={row.detail}>
                    <span className="pemo-identifier">{row.detail}</span>
                    {row.subject ? <div className="pemo-meta">{row.subject}</div> : null}
                  </WrapCell>
                  <DenseCell title={when}>{when}</DenseCell>
                  <td>
                    <PlainChip testId="notice-delivery-row-status">{rowStatus}</PlainChip>
                    {row.attachmentName ? (
                      <div className="pemo-meta">
                        <span className="pemo-identifier">{row.attachmentName}</span>
                      </div>
                    ) : null}
                  </td>
                </tr>
              );
            })}
          </Table>
        )}
      </section>
    </>
  );
}

export function NoticeDueDeliveriesBar({ locale }: { locale: Locale }) {
  const M = MESSAGES.s5;
  useNoticeDeliveryStore();
  return (
    <span className="pemo-tabrow__counter" data-testid="notice-delivery-actions">
      <HintRow text={t(M.deliveryClockNote, locale)} />
      <button
        type="button"
        className="pemo-button"
        data-testid="process-due-notice-deliveries"
        data-read-affordance="fixture"
        title={t(M.runDueDeliveries, locale)}
        onClick={() => { void processDueNoticeDeliveries(); }}
      >
        <Icon name="Zap" size={15} /> {t(M.runDueDeliveries, locale)}
      </button>
    </span>
  );
}
