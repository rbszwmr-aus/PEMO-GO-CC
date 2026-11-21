/**
 * Administration — Email configuration, fixture-first.
 *
 * SMTP settings persist in an in-memory session store (URL/state + module
 * memory). No localStorage. Save writes the store; Send test email writes an
 * Email outbox row and tries a real SMTP send only when Node SMTP_* env is set.
 *
 * @version 0.2.0
 * @changelog
 *   0.2.0 (2026-11-19) SMTP form in two columns on a wide window: host | port, encryption | user name, from name | from address, reply-to | test recipient.
 */

import { HintRow } from '../components/FinanceBits.tsx';
import { FormGrid } from '../components/FormGrid.tsx';
import { useEffect, useState, type FormEvent } from 'react';
import { MESSAGES } from '../i18n/messages.ts';
import { copy, t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import { EmailOutbox, useInvoiceSendStore } from './EmailOutbox.tsx';
import {
  getAdminEmailConfig,
  saveAdminEmailConfig,
  subscribeAdminEmailConfig,
} from '../data/admin-email-corpus.ts';
import { sendAdminTestEmail } from '../finance/invoice-sends.ts';
import type { AdminEmailConfig, AdminEmailEncryption } from '../data/types.ts';

const m = copy;

function useAdminEmailStore(): AdminEmailConfig {
  const [cfg, setCfg] = useState(getAdminEmailConfig);
  useEffect(() => subscribeAdminEmailConfig(() => setCfg(getAdminEmailConfig())), []);
  return cfg;
}

export function AdminEmailConfigForm({
  locale,
  onLiveTest,
}: {
  locale: Locale;
  /**
   * Live test send. The callback receives only the recipient. SMTP host and
   * password stay on the server and are not posted.
   */
  onLiveTest?: (to: string) => Promise<{ ok: true; detail: string } | { ok: false; detail: string }>;
}) {
  const M = MESSAGES.admin;
  const saved = useAdminEmailStore();
  useInvoiceSendStore();
  const [form, setForm] = useState<AdminEmailConfig>(saved);
  const [savedNote, setSavedNote] = useState(false);
  const [testNote, setTestNote] = useState<LocalizedText | null>(null);

  useEffect(() => {
    setForm(saved);
  }, [saved]);

  const set = <K extends keyof AdminEmailConfig>(key: K, value: AdminEmailConfig[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setSavedNote(false);
  };

  const onSave = (e: FormEvent) => {
    e.preventDefault();
    saveAdminEmailConfig(form);
    setSavedNote(true);
    setTestNote(null);
  };

  const onTest = () => {
    if (onLiveTest) {
      void onLiveTest(form.testRecipient).then((result) => {
        setTestNote(m(result.detail, result.detail, result.detail));
      });
      return;
    }
    void sendAdminTestEmail({ config: form }).then((entry) => {
      setTestNote(
        entry.delivery === 'smtp'
          ? entry.status === 'sent'
            ? m('Test email handed to SMTP. See the outbox row.', '測試電郵已交予 SMTP。見寄件匣列。', '测试电子邮件已交予 SMTP。见发件箱列。')
            : m('SMTP was attempted; the outbox recorded the result.', '已嘗試 SMTP；寄件匣已記錄結果。', '已尝试 SMTP；发件箱已记录结果。')
          : m('Test email written to the outbox (SPA has no SMTP transport).', '測試電郵已寫入寄件匣（此 SPA 沒有 SMTP 傳輸）。', '测试电子邮件已写入发件箱（此 SPA 没有 SMTP 传输）。'),
      );
    });
  };

  return (
    <>
      <section className="pemo-panel">
        <h2 className="pemo-panel__title">{t(M.emailTitle, locale)}</h2>
        <HintRow text={t(M.emailBoundaryNote, locale)} />
        <HintRow text={t(M.emailSecretsNote, locale)} testId="admin-email-secrets-note" />
        <HintRow testId={onLiveTest ? 'admin-email-live-label' : 'admin-email-fixture-label'} text={onLiveTest
            ? t(m('Live test send uses server SMTP. This form never uploads SMTP sign-in details.', '即時測試由伺服器 SMTP 發送。此表格不會上傳 SMTP 登入資料。', '即时测试由服务器 SMTP 发送。此表格不会上传 SMTP 登录数据。'), locale)
            : t(M.fixtureLabel, locale)} />
      </section>

      <form
        className="pemo-panel pemo-form"
        data-testid="admin-email-form"
        data-form-act="saveAdminEmail"
        onSubmit={onSave}
      >
        <h3 className="pemo-panel__title">{t(M.emailSmtpHeading, locale)}</h3>
        <FormGrid page>
        <label className="pemo-field" htmlFor="adm-email-host">
          {t(M.emailHost, locale)}
          <input
            id="adm-email-host"
            name="smtpHost"
            value={form.smtpHost}
            onChange={(e) => set('smtpHost', e.target.value)}
            data-testid="admin-email-host"
            data-form-field="true"
            autoComplete="off"
          />
        </label>

        <label className="pemo-field" htmlFor="adm-email-port">
          {t(M.emailPort, locale)}
          <input
            id="adm-email-port"
            name="smtpPort"
            type="number"
            min={1}
            max={65535}
            value={form.smtpPort}
            onChange={(e) => set('smtpPort', Number(e.target.value))}
            data-testid="admin-email-port"
            data-form-field="true"
            autoComplete="off"
          />
        </label>

        <label className="pemo-field" htmlFor="adm-email-encryption">
          {t(M.emailEncryption, locale)}
          <select
            id="adm-email-encryption"
            name="encryption"
            value={form.encryption}
            onChange={(e) => set('encryption', e.target.value as AdminEmailEncryption)}
            data-testid="admin-email-encryption"
            data-form-field="true"
          >
            <option value="none">{t(M.emailEncryptionNone, locale)}</option>
            <option value="starttls">{t(M.emailEncryptionStarttls, locale)}</option>
            <option value="tls">{t(M.emailEncryptionTls, locale)}</option>
          </select>
        </label>

        <label className="pemo-field" htmlFor="adm-email-username">
          {t(M.emailUsername, locale)}
          <input
            id="adm-email-username"
            name="username"
            value={form.username}
            onChange={(e) => set('username', e.target.value)}
            data-testid="admin-email-username"
            data-form-field="true"
            autoComplete="off"
          />
        </label>

        <label className="pemo-field" htmlFor="adm-email-smtp-pass">
          {t(M.emailSmtpPass, locale)}
          <input
            id="adm-email-smtp-pass"
            name="smtpPass"
            className="pemo-field-masked"
            value={form.smtpPass}
            onChange={(e) => set('smtpPass', e.target.value)}
            data-testid="admin-email-smtp-pass"
            data-form-field="true"
            autoComplete="off"
          />
        </label>
        </FormGrid>

        <h3 className="pemo-panel__title">{t(M.emailFromHeading, locale)}</h3>
        <FormGrid page>
        <label className="pemo-field" htmlFor="adm-email-from-name">
          {t(M.emailFromName, locale)}
          <input
            id="adm-email-from-name"
            name="fromName"
            value={form.fromName}
            onChange={(e) => set('fromName', e.target.value)}
            data-testid="admin-email-from-name"
            data-form-field="true"
            autoComplete="off"
          />
        </label>

        <label className="pemo-field" htmlFor="adm-email-from-address">
          {t(M.emailFromAddress, locale)}
          <input
            id="adm-email-from-address"
            name="fromAddress"
            type="email"
            value={form.fromAddress}
            onChange={(e) => set('fromAddress', e.target.value)}
            data-testid="admin-email-from-address"
            data-form-field="true"
            autoComplete="off"
          />
        </label>

        <label className="pemo-field" htmlFor="adm-email-reply-to">
          {t(M.emailReplyTo, locale)}{' '}
          <span className="pemo-meta">({t(M.emailOptional, locale)})</span>
          <input
            id="adm-email-reply-to"
            name="replyTo"
            type="email"
            value={form.replyTo}
            onChange={(e) => set('replyTo', e.target.value)}
            data-testid="admin-email-reply-to"
            data-form-field="true"
            autoComplete="off"
          />
        </label>

        <label className="pemo-field" htmlFor="adm-email-test-to">
          {t(M.emailTestRecipient, locale)}
          <input
            id="adm-email-test-to"
            name="testRecipient"
            type="email"
            value={form.testRecipient}
            onChange={(e) => set('testRecipient', e.target.value)}
            data-testid="admin-email-test-to"
            data-form-field="true"
            autoComplete="off"
          />
        </label>
        </FormGrid>

        <div className="pemo-actions">
          <button
            type="submit"
            className="pemo-button pemo-button--primary"
            data-testid="admin-email-save"
            data-form-field="true"
          >
            {t(M.emailSave, locale)}
          </button>
          <button
            type="button"
            className="pemo-button"
            data-testid="admin-email-send-test"
            data-read-affordance="fixture"
            onClick={onTest}
          >
            {t(M.emailSendTest, locale)}
          </button>
        </div>

        {savedNote ? (
          <p className="pemo-note" data-testid="admin-email-saved" role="status">
            {t(M.emailSaved, locale)}
          </p>
        ) : null}
        {testNote ? (
          <p className="pemo-note" data-testid="admin-email-test-result" role="status">
            {t(testNote, locale)}
          </p>
        ) : null}
      </form>

      <EmailOutbox locale={locale} testId="admin-email-outbox" />
    </>
  );
}
