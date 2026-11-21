/**
 * How a visitor pass QR is shared as an image. Pure decisions; the browser work
 * (canvas, clipboard, anchor click) lives in qr-png.ts and clipboard.ts.
 *
 * Copy as PNG needs a secure context (https or localhost) and ClipboardItem. Plain
 * http over the LAN has neither, which is the usual case here; then, and after a
 * blocked write, the only action offered is Download. The other action is not
 * rendered, never disabled.
 */

export interface ImageCopyEnv {
  secure: boolean;
  hasClipboardWrite: boolean;
  hasClipboardItem: boolean;
}

export type QrImageAction = 'copy-image' | 'download';

export function canCopyImage(env: ImageCopyEnv): boolean {
  return env.secure && env.hasClipboardWrite && env.hasClipboardItem;
}

export function qrImageAction(env: ImageCopyEnv, copyBlocked = false): QrImageAction {
  return canCopyImage(env) && !copyBlocked ? 'copy-image' : 'download';
}

/** visitor-pass-2026-09-23.png: the date is the HKT calendar day the file is saved. */
export function visitorPassFileName(now: Date = new Date()): string {
  const ymd = new Intl.DateTimeFormat('en-CA', {
    year: 'numeric', month: '2-digit', day: '2-digit', timeZone: 'Asia/Hong_Kong',
  }).format(now);
  return `visitor-pass-${ymd}.png`;
}
