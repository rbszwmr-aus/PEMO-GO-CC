/**
 * Draw a pass QR to a PNG: a real image the browser can long-press save, copy to
 * the clipboard, or download. Plain black on white with the quiet zone, so it scans
 * from a screen or a print. Browser-only (canvas); the matrix comes from qr-matrix.ts.
 */
import { QR_QUIET_ZONE, type QrMatrix } from './qr-matrix.ts';

/** Pixels per module. A v10 pass (57 modules + quiet zone) comes out near 520 px square. */
export const QR_PNG_SCALE = 8;

function draw(m: QrMatrix, scale: number): HTMLCanvasElement | null {
  if (typeof document === 'undefined') return null;
  const total = (m.size + QR_QUIET_ZONE * 2) * scale;
  const canvas = document.createElement('canvas');
  canvas.width = total;
  canvas.height = total;
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.fillStyle = 'white';
  ctx.fillRect(0, 0, total, total);
  ctx.fillStyle = 'black';
  for (let r = 0; r < m.size; r += 1) {
    for (let c = 0; c < m.size; c += 1) {
      if (m.dark[r]![c]) ctx.fillRect((c + QR_QUIET_ZONE) * scale, (r + QR_QUIET_ZONE) * scale, scale, scale);
    }
  }
  return canvas;
}

/** `data:image/png;base64,…`, or null where canvas is unavailable. */
export function qrPngDataUrl(m: QrMatrix, scale = QR_PNG_SCALE): string | null {
  try {
    return draw(m, scale)?.toDataURL('image/png') ?? null;
  } catch {
    return null;
  }
}

export function qrPngBlob(m: QrMatrix, scale = QR_PNG_SCALE): Promise<Blob | null> {
  const canvas = draw(m, scale);
  if (!canvas) return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      canvas.toBlob((b) => resolve(b), 'image/png');
    } catch {
      resolve(null);
    }
  });
}
