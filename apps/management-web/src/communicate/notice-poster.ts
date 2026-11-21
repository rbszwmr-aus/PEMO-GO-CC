/**
 * GENERIC A4 notice poster PDF — swap this file when the print layout lands.
 *
 * Same constraints as the invoice template: no pdfkit / puppeteer. Helvetica /
 * WinAnsi only; CJK is stripped so the bytes stay a valid PDF. Staff chrome
 * stays bilingual (en + zh-Hant).
 */

import { isChinese, type Locale } from '../i18n/locale.ts';
import type { StaffNoticeDetail } from '../data/types.ts';

export interface NoticePosterModel {
  noticeId: string;
  titleEn: string;
  titleZhHant: string;
  bodyEn: string;
  bodyZhHant: string;
  scheduledAt: string | null;
  expireAt: string | null;
  scopeLabel: string;
}

export function noticeToPoster(
  notice: Pick<StaffNoticeDetail, 'noticeId' | 'titleEn' | 'titleZhHant' | 'bodyEn' | 'bodyZhHant' | 'expireAt'>,
  extras?: { scheduledAt?: string | null; scopeLabel?: string },
): NoticePosterModel {
  return {
    noticeId: notice.noticeId,
    titleEn: notice.titleEn,
    titleZhHant: notice.titleZhHant,
    bodyEn: notice.bodyEn,
    bodyZhHant: notice.bodyZhHant,
    scheduledAt: extras?.scheduledAt ?? notice.expireAt ?? null,
    expireAt: notice.expireAt ?? null,
    scopeLabel: extras?.scopeLabel ?? 'Wing Fu Garden',
  };
}

/** Latin-1 printable; CJK and other non-WinAnsi codepoints are dropped. */
export function pdfSafe(text: string): string {
  return [...text]
    .map((ch) => {
      const code = ch.codePointAt(0) ?? 0;
      return code >= 0x20 && code <= 0x7e ? ch : '';
    })
    .join('')
    .replace(/\s+/g, ' ')
    .trim();
}

function pdfEscape(text: string): string {
  return pdfSafe(text).replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
}

function wrapLatin(text: string, width: number): string[] {
  const words = pdfSafe(text).split(' ').filter(Boolean);
  if (words.length === 0) return [''];
  const lines: string[] = [];
  let current = words[0]!;
  for (const word of words.slice(1)) {
    if (`${current} ${word}`.length <= width) {
      current = `${current} ${word}`;
    } else {
      lines.push(current);
      current = word;
    }
  }
  lines.push(current);
  return lines;
}

function posterLines(model: NoticePosterModel, locale: Locale): string[] {
  const title = pdfSafe(isChinese(locale) ? model.titleZhHant : model.titleEn)
    || pdfSafe(model.titleEn)
    || model.noticeId;
  const body = pdfSafe(isChinese(locale) ? model.bodyZhHant : model.bodyEn)
    || pdfSafe(model.bodyEn);
  const lines = [
    'ESTATE NOTICE',
    '',
    `Place             ${pdfSafe(model.scopeLabel)}`,
    `Notice            ${model.noticeId}`,
    model.scheduledAt ? `Display from      ${model.scheduledAt}` : 'Display from      when posted',
    model.expireAt ? `Display until     ${model.expireAt}` : 'Display until     taken down',
    '',
    title,
    '',
  ];
  for (const row of wrapLatin(body, 72)) lines.push(row);
  lines.push('');
  lines.push('Please do not remove. Office copy — print / stick.');
  lines.push('Generic poster template — layout will change.');
  return lines;
}

function contentStream(model: NoticePosterModel, locale: Locale): string {
  const ops: string[] = ['BT', '/F1 18 Tf', '50 800 Td', '(ESTATE NOTICE) Tj', '/F1 10 Tf'];
  const rest = posterLines(model, locale).slice(1);
  for (const line of rest) {
    ops.push('0 -14 Td');
    ops.push(`(${pdfEscape(line)}) Tj`);
  }
  ops.push('ET');
  return ops.join('\n');
}

function pad10(n: number): string {
  return String(n).padStart(10, '0');
}

/**
 * Render a one-page A4 poster. Replace this function (or this file) when the
 * designed print layout arrives.
 */
export function renderNoticePosterPdf(model: NoticePosterModel, locale: Locale = 'en'): Uint8Array {
  const stream = contentStream(model, locale);
  const encoder = new TextEncoder();
  const streamBytes = encoder.encode(stream);

  const objects: string[] = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>',
    `<< /Length ${streamBytes.length} >>\nstream\n${stream}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
  ];

  let body = '%PDF-1.4\n';
  const offsets = [0];
  for (let i = 0; i < objects.length; i++) {
    offsets.push(encoder.encode(body).length);
    body += `${i + 1} 0 obj\n${objects[i]}\nendobj\n`;
  }
  const xrefAt = encoder.encode(body).length;
  let xref = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let i = 1; i <= objects.length; i++) {
    xref += `${pad10(offsets[i]!)} 00000 n \n`;
  }
  body += xref;
  body += `trailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefAt}\n%%EOF\n`;
  return encoder.encode(body);
}

export function noticePosterFileName(model: NoticePosterModel): string {
  return `notice-${model.noticeId}-poster.pdf`;
}

export function noticePosterPdfDataUrl(model: NoticePosterModel, locale: Locale = 'en'): string {
  const bytes = renderNoticePosterPdf(model, locale);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:application/pdf;base64,${btoa(binary)}`;
}
