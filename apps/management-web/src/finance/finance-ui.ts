/**
 * Presentation rules for Payments & refunds (PEMO UI style guide v3 §5–§7).
 * Pure data so node:test can check them without a browser.
 */

import type { IconName, IconSpec } from '../components/icon-shapes.ts';
import type { ChargeStatus, PaymentMethod, RefundStatus } from '../data/finance-fixtures.ts';

/**
 * Status-tag tone (PT bot guideline §6). Every tag is a light solid background
 * with no border. `alert` is pale red (Due). Only `urgent` (Overdue) gets a
 * strong solid fill.
 */
export type TagTone = 'neutral' | 'info' | 'alert' | 'attention' | 'positive' | 'urgent';

export const CHARGE_STATUS_TAG: Record<ChargeStatus, { tone: TagTone; icon: IconName }> = {
  due: { tone: 'alert', icon: 'Clock' },
  overdue: { tone: 'urgent', icon: 'CircleAlert' },
  partial: { tone: 'attention', icon: 'CircleDashed' },
  paid: { tone: 'positive', icon: 'CircleCheck' },
};

export const REFUND_STATUS_TAG: Record<RefundStatus, { tone: TagTone; icon: IconName }> = {
  pending: { tone: 'attention', icon: 'Hourglass' },
  issued: { tone: 'info', icon: 'FileCheck' },
  executed: { tone: 'positive', icon: 'CircleCheck' },
};

export const PAYMENT_METHOD_ICON: Record<PaymentMethod, IconName> = {
  fps: 'Zap',
  cheque: 'NotebookPen',
  cash: 'Coins',
  octopus: 'Nfc',
};

/** Object icons, used for nav, row links and record links (charge → payment → refund). */
export const FINANCE_OBJECT_ICON = {
  finance: 'Wallet',
  charge: 'Receipt',
  payment: 'CreditCard',
  refund: 'Refund',
} as const satisfies Record<string, IconSpec>;

/**
 * Send invoice is consequential, so it goes details → review → confirm, and
 * success shows only after the send reports back (§7).
 */
export type SendStep = 'idle' | 'review' | 'sending' | 'sent' | 'failed';
export type SendEvent = 'send' | 'cancel' | 'confirm' | 'succeeded' | 'failed';

export function nextSendStep(step: SendStep, event: SendEvent): SendStep {
  switch (event) {
    case 'send':
      return step === 'idle' || step === 'failed' ? 'review' : step;
    case 'cancel':
      return step === 'review' ? 'idle' : step;
    case 'confirm':
      return step === 'review' ? 'sending' : step;
    case 'succeeded':
      return step === 'sending' ? 'sent' : step;
    case 'failed':
      return step === 'sending' ? 'failed' : step;
  }
}

/** Invoice send state: Scheduled / Due to send are info (blue), Sent is positive. */
export const INVOICE_SEND_TONE = { scheduled: 'info', due: 'info', sent: 'positive' } as const satisfies Record<string, TagTone>;
