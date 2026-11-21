/**
 * Copy-only share. navigator.clipboard where the browser allows it (secure
 * contexts); otherwise a hidden-textarea copy, which is what plain-http LAN
 * access needs. Nothing is ever sent anywhere.
 */
export async function copyText(text: string): Promise<boolean> {
  try {
    if (typeof window !== 'undefined' && window.isSecureContext && navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    /* fall back */
  }
  try {
    const ta = document.createElement('textarea');
    ta.value = text;
    ta.setAttribute('readonly', '');
    ta.style.position = 'fixed';
    ta.style.top = '0';
    ta.style.left = '0';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.focus();
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    return ok;
  } catch {
    return false;
  }
}

/** What this browser can do with an image on the clipboard. */
export function imageCopyEnv(): { secure: boolean; hasClipboardWrite: boolean; hasClipboardItem: boolean } {
  return {
    secure: typeof window !== 'undefined' && window.isSecureContext === true,
    hasClipboardWrite: typeof navigator !== 'undefined' && typeof navigator.clipboard?.write === 'function',
    hasClipboardItem: typeof ClipboardItem !== 'undefined',
  };
}

/** Put a PNG on the clipboard. False when the API is missing or the browser refuses. */
export async function copyImagePng(blob: Blob): Promise<boolean> {
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob })]);
    return true;
  } catch {
    return false;
  }
}

/** Save a PNG data URL as a file (anchor with `download`). */
export function downloadDataUrl(dataUrl: string, fileName: string): boolean {
  try {
    const a = document.createElement('a');
    a.href = dataUrl;
    a.download = fileName;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    return true;
  } catch {
    return false;
  }
}
