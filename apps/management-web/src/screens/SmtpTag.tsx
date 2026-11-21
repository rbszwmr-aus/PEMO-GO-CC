/** Honest transport state for the SPA outbox, linking to Administration → Email. */

import { MESSAGES } from '../i18n/messages.ts';
import { t, type Locale } from '../i18n/locale.ts';
import { Icon } from '../components/Icon.tsx';
import { StatusTag } from '../components/FinanceBits.tsx';

/** Honest transport state for the SPA outbox, linking to Administration → Email. */
export function SmtpTag({ locale }: { locale: Locale }) {
  const M = MESSAGES.finance;
  return (
    <span className="pemo-source" data-testid="smtp-status">
      <StatusTag tone="attention" icon="Mail" testId="smtp-not-configured">{t(M.smtpNotConfigured, locale)}</StatusTag>
      <a className="pemo-backlink" href={`?screen=adminEmail&state=default&lang=${locale}`} data-testid="smtp-settings-link" data-read-affordance="navigate">
        <span>{t(M.emailSettings, locale)}</span>
        <Icon name="ChevronRight" size={14} />
      </a>
    </span>
  );
}
