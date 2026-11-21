import { useState } from 'react';
import { MESSAGES } from '../../i18n/messages.ts';
import { t, type Locale } from '../../i18n/locale.ts';
import { formatHktStamp } from '../../format/datetime.ts';
import {
  fillTemplate,
  passDisplayStatus,
  visitorDetailLink,
  type VisitorPass,
} from '../../data/visitor-pass.ts';
import { copyImagePng, copyText, downloadDataUrl, imageCopyEnv } from '../../data/clipboard.ts';
import { qrImageAction, visitorPassFileName } from '../../data/pass-share.ts';
import { qrPngBlob, qrPngDataUrl } from '../../data/qr-png.ts';
import { QrCode, useQrMatrix } from '../../components/QrCode.tsx';

type CopyKind = 'link' | 'code';
type Toast = { tone: 'success' | 'error'; text: string };

function currentBase(): string {
  return `${window.location.origin}${window.location.pathname}`;
}

export function VisitorPassPanel({
  pass,
  visitorId,
  locale,
}: {
  pass: VisitorPass | null | undefined;
  visitorId: string;
  locale: Locale;
}) {
  const M = MESSAGES.visitorPortal;
  const [copied, setCopied] = useState<CopyKind | null>(null);
  const [manual, setManual] = useState<string | null>(null);
  const [toast, setToast] = useState<Toast | null>(null);
  const [copyBlocked, setCopyBlocked] = useState(false);
  const matrix = useQrMatrix(pass?.qr.payload ?? '', pass?.qr.min_version ?? 1);

  if (!pass) {
    return (
      <section className="pemo-pass" data-testid="portal-visitor-pass-none">
        <h2 className="pemo-pass__title">{t(M.passTitle, locale)}</h2>
        <p className="pemo-pass__none-title">{t(M.passNoneTitle, locale)}</p>
        <p className="pemo-note">{t(M.passNoneBody, locale)}</p>
      </section>
    );
  }

  const display = passDisplayStatus(pass);
  const none = t(M.passValueNone, locale);
  const hkt = (iso: string | null) => (iso ? formatHktStamp(iso, locale) : none);
  const uses =
    pass.use_limit > 0
      ? fillTemplate(t(M.passUsesValue, locale), {
          seen: String(pass.uses_seen),
          limit: String(pass.use_limit),
        })
      : fillTemplate(t(M.passUsesSeenOnly, locale), { seen: String(pass.uses_seen) });
  const remaining =
    pass.uses_remaining === null
      ? t(M.passUnlimited, locale)
      : fillTemplate(t(M.passRemainingValue, locale), { n: String(pass.uses_remaining) });
  const link = visitorDetailLink(currentBase(), visitorId, locale);

  const imageAction = qrImageAction(imageCopyEnv(), copyBlocked);

  function say(next: Toast) {
    setToast(next);
    window.setTimeout(() => setToast((c) => (c === next ? null : c)), 4000);
  }

  async function copy(kind: CopyKind, text: string) {
    const ok = await copyText(text);
    if (ok) {
      setCopied(kind);
      setManual(null);
      window.setTimeout(() => setCopied((c) => (c === kind ? null : c)), 2500);
    } else {
      setCopied(null);
      setManual(text);
    }
  }

  async function copyImage() {
    const blob = matrix ? await qrPngBlob(matrix) : null;
    if (blob && (await copyImagePng(blob))) {
      say({ tone: 'success', text: t(M.passImageCopied, locale) });
      return;
    }
    // Blocked or refused: from here on only Download is offered.
    setCopyBlocked(true);
    say({ tone: 'error', text: t(M.passImageCopyFailed, locale) });
  }

  function download() {
    const url = matrix ? qrPngDataUrl(matrix) : null;
    const file = visitorPassFileName();
    if (url && downloadDataUrl(url, file)) {
      say({ tone: 'success', text: fillTemplate(t(M.passDownloaded, locale), { file }) });
    } else {
      say({ tone: 'error', text: t(M.passDownloadFailed, locale) });
    }
  }

  return (
    <section
      className="pemo-pass"
      data-testid="portal-visitor-pass"
      data-pass-id={pass.pass_id}
      data-pass-status={display}
      data-pass-api-status={pass.status}
      data-qr-text={pass.qr.payload}
    >
      <h2 className="pemo-pass__title">{t(M.passTitle, locale)}</h2>
      <div className="pemo-pass__body">
        <div className={display === 'active' ? 'pemo-pass__qr' : 'pemo-pass__qr pemo-pass__qr--inactive'}>
          <QrCode
            matrix={matrix}
            label={fillTemplate(t(M.passQrLabel, locale), { id: pass.pass_id })}
            fallback={t(M.passQrError, locale)}
          />
          <p className="pemo-meta">{t(M.passScanHint, locale)}</p>
          {matrix ? <p className="pemo-meta pemo-pass__hold" data-testid="portal-pass-hold-hint">{t(M.passHoldHint, locale)}</p> : null}
        </div>
        <div className="pemo-pass__facts">
          <p className="pemo-pass__status-row">
            <span
              className={`pemo-chip pemo-pass-pill pemo-pass-pill--${display}`}
              data-testid="portal-pass-status"
            >
              {t(M.passStatus[display], locale)}
            </span>
          </p>
          <dl className="pemo-dl">
            <dt>{t(M.passValidFrom, locale)}</dt>
            <dd data-testid="portal-pass-valid-from">{hkt(pass.not_before)}</dd>
            <dt>{t(M.passValidTo, locale)}</dt>
            <dd data-testid="portal-pass-valid-to">{hkt(pass.expires_at)}</dd>
            <dt>{t(M.passUses, locale)}</dt>
            <dd data-testid="portal-pass-uses">{uses}</dd>
            <dt>{t(M.passRemaining, locale)}</dt>
            <dd data-testid="portal-pass-remaining">{remaining}</dd>
            {pass.status === 'revoked' ? (
              <>
                <dt>{t(M.passRevokedAt, locale)}</dt>
                <dd data-testid="portal-pass-revoked-at">{hkt(pass.revoked_at)}</dd>
                <dt>{t(M.passRevokedReason, locale)}</dt>
                <dd data-testid="portal-pass-revoked-reason">{pass.revocation_reason ?? none}</dd>
              </>
            ) : null}
          </dl>
          <details className="pemo-pass__details" data-testid="portal-pass-details">
            <summary>{t(M.passDetails, locale)}</summary>
            <dl className="pemo-dl">
              <dt>{t(M.passId, locale)}</dt>
              <dd>
                <span className="pemo-identifier" data-testid="portal-pass-id">{pass.pass_id}</span>
              </dd>
              <dt>{t(M.passApiStatusLabel, locale)}</dt>
              <dd data-testid="portal-pass-api-status">{pass.status}</dd>
            </dl>
          </details>
          <div className="pemo-toolbar" data-testid="portal-pass-share">
            {matrix && imageAction === 'copy-image' ? (
              <button
                type="button"
                className="pemo-btn pemo-btn--primary"
                data-testid="portal-pass-copy-image"
                onClick={() => void copyImage()}
              >
                {t(M.passCopyImage, locale)}
              </button>
            ) : null}
            {matrix && imageAction === 'download' ? (
              <button
                type="button"
                className="pemo-btn pemo-btn--primary"
                data-testid="portal-pass-download"
                onClick={download}
              >
                {t(M.passDownload, locale)}
              </button>
            ) : null}
            <button
              type="button"
              className="pemo-btn"
              data-testid="portal-pass-copy-link"
              onClick={() => void copy('link', link)}
            >
              {t(M.passCopyLink, locale)}
            </button>
            <button
              type="button"
              className="pemo-btn"
              data-testid="portal-pass-copy-code"
              onClick={() => void copy('code', pass.qr.payload)}
            >
              {t(M.passCopyCode, locale)}
            </button>
            <span className="pemo-meta" role="status" aria-live="polite" data-testid="portal-pass-copied">
              {copied ? t(M.passCopied, locale) : null}
            </span>
          </div>
          <div role="status" aria-live="polite" data-testid="portal-pass-toast-region">
            {toast ? (
              <p
                className={`pemo-pass__toast pemo-pass__toast--${toast.tone}`}
                data-testid="portal-pass-toast"
                data-tone={toast.tone}
              >
                {toast.text}
              </p>
            ) : null}
          </div>
          {manual ? (
            <div className="pemo-pass__manual-wrap" data-testid="portal-pass-copy-manual">
              <p className="pemo-note" role="alert">{t(M.passCopyFailed, locale)}</p>
              <textarea
                className="pemo-pass__manual"
                readOnly
                rows={3}
                value={manual}
                aria-label={t(M.passCopyManual, locale)}
                onFocus={(e) => e.currentTarget.select()}
              />
            </div>
          ) : null}
          <p className="pemo-note">{t(M.passShareNote, locale)}</p>
        </div>
      </div>
    </section>
  );
}