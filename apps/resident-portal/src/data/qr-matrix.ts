/**
 * QR matrix for a visitor pass, drawn client-side (qrcode-generator, no network).
 *
 * The pass service fixes the encoding: alphanumeric mode, ECC M, and a minimum
 * version (`qr.min_version`). The library picks the smallest version that fits;
 * if that is below the minimum, the minimum is used instead.
 */
import qrcode from 'qrcode-generator';

type TypeNumber = Parameters<typeof qrcode>[0];

/** Quiet zone in modules, per ISO/IEC 18004. */
export const QR_QUIET_ZONE = 4;

export interface QrMatrix {
  version: number;
  size: number;
  dark: boolean[][];
}

function build(text: string, typeNumber: number) {
  const q = qrcode(typeNumber as TypeNumber, 'M');
  q.addData(text, 'Alphanumeric');
  q.make();
  return q;
}

/** null when the text cannot be encoded in alphanumeric mode. */
export function qrMatrix(text: string, minVersion: number): QrMatrix | null {
  const min = Math.min(40, Math.max(1, Math.floor(minVersion) || 1));
  try {
    let q = build(text, 0);
    let version = (q.getModuleCount() - 17) / 4;
    if (version < min) {
      q = build(text, min);
      version = min;
    }
    const size = q.getModuleCount();
    const dark = Array.from({ length: size }, (_, r) =>
      Array.from({ length: size }, (_, c) => q.isDark(r, c)),
    );
    return { version, size, dark };
  } catch {
    return null;
  }
}

/** SVG path data: one unit square per dark module, offset by the quiet zone. */
export function qrPath(m: QrMatrix, quiet = QR_QUIET_ZONE): string {
  const parts: string[] = [];
  for (let r = 0; r < m.size; r += 1) {
    for (let c = 0; c < m.size; c += 1) {
      if (m.dark[r]![c]) parts.push(`M${c + quiet} ${r + quiet}h1v1h-1z`);
    }
  }
  return parts.join('');
}