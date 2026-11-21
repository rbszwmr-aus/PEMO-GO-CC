import { useMemo } from 'react';
import { QR_QUIET_ZONE, qrMatrix, qrPath, type QrMatrix } from '../data/qr-matrix.ts';
import { qrPngDataUrl } from '../data/qr-png.ts';

const CRISP = 'crispEdges';

/** The pass matrix, or null when the text cannot be encoded. Shared by the image and its copy/download. */
export function useQrMatrix(text: string, minVersion: number): QrMatrix | null {
  return useMemo(() => qrMatrix(text, minVersion), [text, minVersion]);
}

/**
 * A pass QR drawn as a real <img> with a PNG data URL, so a long-press on a phone
 * saves the picture. Where canvas is unavailable it falls back to inline SVG.
 * Colours come from CSS tokens for the SVG; the PNG is plain black on white.
 */
export function QrCode({
  matrix,
  label,
  fallback,
}: {
  matrix: QrMatrix | null;
  label: string;
  fallback: string;
}) {
  const png = useMemo(() => (matrix ? qrPngDataUrl(matrix) : null), [matrix]);
  if (!matrix) {
    return (
      <p className="pemo-note" role="alert" data-testid="portal-pass-qr-error">
        {fallback}
      </p>
    );
  }
  if (png) {
    return (
      <img
        className="pemo-qr pemo-qr--img"
        src={png}
        alt={label}
        data-testid="portal-pass-qr"
        data-qr-kind="png"
        data-qr-version={matrix.version}
        data-qr-size={matrix.size}
      />
    );
  }
  const total = matrix.size + QR_QUIET_ZONE * 2;
  return (
    <svg
      className="pemo-qr"
      role="img"
      aria-label={label}
      viewBox={`0 0 ${total} ${total}`}
      shapeRendering={CRISP}
      data-testid="portal-pass-qr"
      data-qr-kind="svg"
      data-qr-version={matrix.version}
      data-qr-size={matrix.size}
    >
      <rect className="pemo-qr__quiet" x={0} y={0} width={total} height={total} />
      <path className="pemo-qr__dark" d={qrPath(matrix)} />
    </svg>
  );
}
