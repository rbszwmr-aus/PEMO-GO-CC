/**
 * Help bubble (4S guide sections 9 and 14): optional explanation behind an "i"
 * button. The bubble opens on hover, on keyboard focus and on tap or click, and
 * closes on Escape or blur. The text is also the button's accessible name.
 * Never the only home of a safety or error message.
 */

import { useId, useRef, useState } from 'react';

export function HelpBubble({ text, testId, source }: { text: string; testId?: string; source?: string }) {
  const id = useId();
  const btn = useRef<HTMLButtonElement>(null);
  const [at, setAt] = useState<{ left: number; top: number; width: number } | null>(null);
  const show = () => {
    const r = btn.current?.getBoundingClientRect();
    if (!r) return;
    const width = Math.min(300, window.innerWidth - 16);
    setAt({ left: Math.max(8, Math.min(r.left + r.width / 2 - width / 2, window.innerWidth - width - 8)), top: r.bottom + 6, width });
  };
  return (
    <span className="pemo-help">
      <button
        ref={btn}
        type="button"
        className="pemo-help__button"
        aria-label={text}
        aria-describedby={at ? id : undefined}
        aria-expanded={at !== null}
        data-testid={testId}
        data-source={source}
        onMouseEnter={show}
        onMouseLeave={() => setAt(null)}
        onFocus={show}
        onBlur={() => setAt(null)}
        onClick={() => (at ? setAt(null) : show())}
        onKeyDown={(e) => { if (e.key === 'Escape') setAt(null); }}
      >
        <span className="pemo-help__glyph" aria-hidden="true" />
      </button>
      {at ? (
        <span role="tooltip" id={id} className="pemo-help__bubble" style={{ left: at.left, top: at.top, width: at.width }}>
          {text}
        </span>
      ) : null}
    </span>
  );
}
