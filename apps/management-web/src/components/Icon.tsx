/**
 * Inline-SVG icons. Shapes are vendored from lucide in icon-shapes.ts (ISC
 * licence notice kept there); no icon package is a runtime dependency.
 */

import type { CSSProperties } from 'react';
import { ICON_SHAPES, ICON_SIZE, type IconName, type IconSpec, type Shape } from './icon-shapes.ts';

export { ICON_SIZE, type IconName, type IconSpec };

/**
 * One lucide shape as inline SVG. Decorative by default (`aria-hidden`); pass
 * `label` only when the icon IS the accessible name — an icon-only control
 * should instead put `aria-label` on the button and leave the icon decorative.
 */
export function Icon({
  name,
  size = ICON_SIZE.control,
  strokeWidth = 1.75,
  label,
  className,
  style,
}: {
  name: IconName;
  size?: number;
  strokeWidth?: number;
  label?: string | undefined;
  className?: string | undefined;
  style?: CSSProperties | undefined;
}) {
  const shapes: Shape = ICON_SHAPES[name];
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className ? `pemo-icon ${className}` : 'pemo-icon'}
      style={style}
      data-icon={name}
      focusable="false"
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      {shapes.map(([tag, attrs], i) => {
        const Tag = tag as 'path';
        return <Tag key={i} {...attrs} />;
      })}
    </svg>
  );
}

/**
 * Refund composite (v3 §5): Banknote dominant (~22×18 at 22 px), with a small
 * Undo2 return arrow (~7×7) tucked into the bottom-right corner on a white
 * knockout so it does not cut the note's stroke.
 */
export function RefundIcon({ size = ICON_SIZE.leading, label }: { size?: number; label?: string }) {
  const arrow = Math.max(7, Math.round(size * 0.36));
  return (
    <span
      className="pemo-icon-refund"
      data-icon="Refund"
      style={{ width: size, height: size }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <Icon name="Banknote" size={size} />
      <span className="pemo-icon-refund__arrow" style={{ width: arrow + 2, height: arrow + 2 }}>
        <Icon name="Undo2" size={arrow} strokeWidth={2.5} />
      </span>
    </span>
  );
}

/** Render an IconSpec: a lucide shape or the Refund composite. */
export function SpecIcon({ spec, size = ICON_SIZE.control }: { spec: IconSpec; size?: number }) {
  return spec === 'Refund' ? <RefundIcon size={size} /> : <Icon name={spec} size={size} />;
}
