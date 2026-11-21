/**
 * GENERIC management-fee invoice PDF — swap this file when the layout lands.
 *
 * One writer, no pdfkit / @react-pdf / puppeteer. The management-web browser
 * runtime stays react + react-dom; this module is plain TypeScript and runs
 * in both Node tests and the SPA. Helvetica / WinAnsi only: CJK is stripped
 * so the bytes stay a valid PDF. Staff chrome stays bilingual (en + zh-Hant).
 */

import { t, type Locale, type LocalizedText } from '../i18n/locale.ts';
import {
  estateLabel,
  hkd,
  periodLabel,
  unitPathLabel,
  type ChargeRow,
} from '../data/finance-fixtures.ts';

export interface InvoiceModel {
  invoiceNumber: string;
  estateName: LocalizedText;
  unitPath: LocalizedText;
  householdId: string;
  payerName: string;
  contactEmail: string;
  period: string;
  issuedOn: string;
  dueOn: string;
  issuedAt: string;
  lineItems: Array<{ description: LocalizedText; amountHkd: number }>;
  totalHkd: number;
  chargeId: string;
}

export function chargeToInvoice(row: ChargeRow): InvoiceModel {
  return {
    invoiceNumber: row.invoiceNumber,
    estateName: estateLabel(row.scope),
    unitPath: unitPathLabel(row.scope, row.unitSummary),
    householdId: row.householdId,
    payerName: row.payerName,
    contactEmail: row.contactEmail,
    period: row.period,
    issuedOn: row.issuedOn,
    dueOn: row.dueOn,
    issuedAt: `${row.issuedOn}T00:00:00+08:00`,
    lineItems: row.lineItems,
    totalHkd: row.amountHkd,
    chargeId: row.chargeId,
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

function invoiceLines(model: InvoiceModel, locale: Locale): string[] {
  const estate = pdfSafe(t(model.estateName, locale)) || pdfSafe(model.estateName.en);
  const unit = pdfSafe(t(model.unitPath, locale)) || pdfSafe(model.unitPath.en);
  const period = periodLabel(model.period, 'en');
  const lines = [
    'INVOICE',
    '',
    `Estate            ${estate}`,
    `Unit path         ${unit}`,
    `Household / payer ${pdfSafe(model.payerName)}`,
    `Household id      ${model.householdId}`,
    `Contact           ${model.contactEmail}`,
    '',
    `Invoice No.       ${model.invoiceNumber}`,
    `Charge            ${model.chargeId}`,
    `Period            ${model.period} (${period})`,
    `Issued at         ${model.issuedAt}`,
    `Due date          ${model.dueOn}`,
    '',
    'Line items',
    '----------------------------------------------',
  ];
  for (const item of model.lineItems) {
    const desc = pdfSafe(t(item.description, locale)) || pdfSafe(item.description.en);
    lines.push(`${desc.padEnd(32)} ${hkd(item.amountHkd, 'en')}`);
  }
  lines.push('----------------------------------------------');
  lines.push(`Total HKD                         ${hkd(model.totalHkd, 'en')}`);
  lines.push('');
  lines.push('Generic template — layout will change.');
  return lines;
}

function contentStream(model: InvoiceModel, locale: Locale): string {
  const ops: string[] = ['BT', '/F1 16 Tf', '50 800 Td', '(INVOICE) Tj', '/F1 10 Tf'];
  const rest = invoiceLines(model, locale).slice(1);
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
 * Render a one-page A4 PDF. Replace this function (or this file) when the
 * designed invoice layout arrives.
 */
export function renderInvoicePdf(model: InvoiceModel, locale: Locale = 'en'): Uint8Array {
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

export function invoicePdfFileName(model: InvoiceModel): string {
  return `${model.invoiceNumber}.pdf`;
}

export function invoicePdfDataUrl(model: InvoiceModel, locale: Locale = 'en'): string {
  const bytes = renderInvoicePdf(model, locale);
  let binary = '';
  for (const b of bytes) binary += String.fromCharCode(b);
  return `data:application/pdf;base64,${btoa(binary)}`;
}
