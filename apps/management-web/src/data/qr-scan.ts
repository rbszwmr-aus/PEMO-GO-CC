/**
 * Camera scan for the front counter, with the browser’s own BarcodeDetector. No
 * library. Where the detector or the camera is missing (it needs a secure context
 * for the camera, and not every browser ships the detector) the scan button is not
 * rendered at all: the manual pass-code field is the path.
 */

interface DetectorLike {
  detect(source: CanvasImageSource): Promise<Array<{ rawValue: string }>>;
}
type DetectorCtor = new (opts?: { formats?: string[] }) => DetectorLike;

export interface ScanEnv {
  BarcodeDetector?: unknown;
  isSecureContext?: boolean;
  mediaDevices?: { getUserMedia?: unknown } | undefined;
}

export function scanSupported(env: ScanEnv): boolean {
  return (
    typeof env.BarcodeDetector === 'function' &&
    env.isSecureContext === true &&
    typeof env.mediaDevices?.getUserMedia === 'function'
  );
}

export function browserScanEnv(): ScanEnv {
  if (typeof window === 'undefined') return {};
  return {
    BarcodeDetector: (window as unknown as { BarcodeDetector?: unknown }).BarcodeDetector,
    isSecureContext: window.isSecureContext,
    mediaDevices: typeof navigator !== 'undefined' ? navigator.mediaDevices : undefined,
  };
}

/** Open the camera in `video` and call `onCode` once with the first QR value read. Returns a stop function. */
export async function startScan(
  video: HTMLVideoElement,
  onCode: (value: string) => void,
  onError: () => void,
): Promise<() => void> {
  const Ctor = (window as unknown as { BarcodeDetector: DetectorCtor }).BarcodeDetector;
  let stream: MediaStream | null = null;
  let stopped = false;
  const stop = () => {
    stopped = true;
    stream?.getTracks().forEach((tr) => tr.stop());
    video.srcObject = null;
  };
  try {
    stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' }, audio: false });
    if (stopped) { stop(); return stop; }
    video.srcObject = stream;
    // A camera that is slow to start must not stall the scan loop: frames that are not ready just fail to decode and are retried.
    void video.play().catch(() => undefined);
    const detector = new Ctor({ formats: ['qr_code'] });
    const tick = async () => {
      if (stopped) return;
      try {
        const found = await detector.detect(video);
        const value = found[0]?.rawValue;
        if (value) {
          stop();
          onCode(value);
          return;
        }
      } catch {
        /* a frame that fails to decode is not an error */
      }
      window.setTimeout(() => void tick(), 250);
    };
    void tick();
  } catch {
    stop();
    onError();
  }
  return stop;
}
