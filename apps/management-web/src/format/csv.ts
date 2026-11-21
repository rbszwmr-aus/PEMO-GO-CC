/**
 * CSV text for a table: header row, CRLF line ends, quotes doubled, a UTF-8 BOM so
 * Excel reads Chinese correctly. Pure, so the quoting rules are node-testable.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-19) New.
 */

const cell = (v: string): string => (/[",\r\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

export function csvText(head: readonly string[], rows: ReadonlyArray<readonly string[]>): string {
  return `\ufeff${[head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n')}\r\n`;
}
