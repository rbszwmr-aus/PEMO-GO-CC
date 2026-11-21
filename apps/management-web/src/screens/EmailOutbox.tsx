/**
 * Email outbox for scheduled management-fee invoices. Fixture store — not a
 * live mail API. Same rows on Payments and on charge detail.
 */

import { useEffect, useState } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { dateTime } from '../format/datetime.ts';
import { Table, DenseCell, WrapCell } from '../components/Table.tsx';
import { StatusTag, TitleStrip } from '../components/FinanceBits.tsx';
import { findCharge, periodLabel } from '../data/finance-fixtures.ts';
import {
  outboxEntries,
  outboxForCharge,
  subscribeInvoiceSends,
  type OutboxEntry,
} from '../finance/invoice-sends.ts';
import type { OutboxStatus } from '../data/finance-fixtures.ts';

export function useInvoiceSendStore(): number {
  const [revision, setRevision] = useState(0);
  useEffect(() => subscribeInvoiceSends(() => setRevision((n) => n + 1)), []);
  return revision;
}

export function EmailOutbox({
  locale,
  chargeId,
  testId = 'email-outbox',
}: {
  locale: Locale;
  chargeId?: string;
  testId?: string;
}) {
  const M = MESSAGES.finance;
  useInvoiceSendStore();
  const rows: OutboxEntry[] = chargeId ? outboxForCharge(chargeId) : outboxEntries();

  return (
    <section className="pemo-panel" data-testid={testId}>
      <TitleStrip icon="Inbox" title={t(M.outboxHeading, locale)} />
      {rows.length === 0 ? (
        <p className="pemo-note" data-testid="outbox-empty">{t(M.outboxNone, locale)}</p>
      ) : (
        <Table
          caption={t(M.outboxHeading, locale)}
          columns={[
            { key: 'to', label: t(M.colOutboxTo, locale), width: '28%', hideBelow: 600 },
            { key: 'subject', label: t(M.colOutboxSubject, locale), width: '34%' },
            { key: 'sent', label: t(M.colOutboxSentAt, locale), width: '22%', hideBelow: 600 },
            { key: 'status', label: t(M.colOutboxStatus, locale), width: '16%' },
          ]}
          testId={`${testId}-table`}
        >
          {rows.map((e) => {
            const when = dateTime(e.sentAt, locale);
            const statusKey: OutboxStatus = e.status;
            const status = t(M.outboxStatus[statusKey], locale);
            const subject = staffSubject(e.chargeId, locale);
            return (
              <tr
                key={e.outboxId}
                data-testid="outbox-row"
                data-outbox-id={e.outboxId}
                data-charge-id={e.chargeId}
                data-status={e.status}
              >
                <td className="pemo-cell--email" data-testid="outbox-to">{e.to}</td>
                <td className="pemo-cell--wrap">
                  {subject}
                  <div className="pemo-meta pemo-cell--email" data-alt="to">{e.to}</div>
                  <div className="pemo-meta" data-alt="sent">{when}</div>
                </td>
                <DenseCell title={when}>{when}</DenseCell>
                <td>
                  <StatusTag tone={e.status === 'failed' ? 'alert' : e.status === 'sent' ? 'positive' : 'neutral'} icon={e.status === 'failed' ? 'CircleAlert' : e.status === 'sent' ? 'CircleCheck' : 'Inbox'} testId="outbox-status">{status}</StatusTag>
                </td>
              </tr>
            );
          })}
        </Table>
      )}
    </section>
  );
}

/**
 * The subject in staff words and in the page language: "Invoice — Monthly
 * management fee · Aug 2026". The stored subject carries the invoice number
 * (a system code), which stays in the email itself and in IT details.
 */
export function staffSubject(chargeId: string, locale: Locale): string {
  const c = findCharge(chargeId);
  const head = t(MESSAGES.finance.outboxSubjectFor, locale);
  return c ? `${head} — ${t(c.kind, locale)} · ${periodLabel(c.period, locale)}` : head;
}
