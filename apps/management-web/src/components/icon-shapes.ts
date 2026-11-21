/**
 * Vendored lucide icon shapes (lucide-static v1.56.0), inline SVG.
 *
 * The PO ruling in package.json keeps the browser runtime to react, react-dom and
 * scheduler, so lucide-react is NOT a dependency. These shapes are copied
 * verbatim from lucide (one family, 24-unit grid, round caps) under its ISC
 * licence, reproduced below as the licence requires.
 *
 * ISC License
 *
 * Copyright (c) 2026 Lucide Icons and Contributors
 *
 * Permission to use, copy, modify, and/or distribute this software for any
 * purpose with or without fee is hereby granted, provided that the above
 * copyright notice and this permission notice appear in all copies.
 *
 * THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES
 * WITH REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF
 * MERCHANTABILITY AND FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR
 * ANY SPECIAL, DIRECT, INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES
 * WHATSOEVER RESULTING FROM LOSS OF USE, DATA OR PROFITS, WHETHER IN AN
 * ACTION OF CONTRACT, NEGLIGENCE OR OTHER TORTIOUS ACTION, ARISING OUT OF
 * OR IN CONNECTION WITH THE USE OR PERFORMANCE OF THIS SOFTWARE.
 *
 * ---
 *
 * The following Lucide icons are derived from the Feather project:
 *
 * airplay, alert-circle, alert-octagon, alert-triangle, aperture, arrow-down-circle, arrow-down-left, arrow-down-right, arrow-down, arrow-left-circle, arrow-left, arrow-right-circle, arrow-right, arrow-up-circle, arrow-up-left, arrow-up-right, arrow-up, at-sign, calendar, cast, check, chevron-down, chevron-left, chevron-right, chevron-up, chevrons-down, chevrons-left, chevrons-right, chevrons-up, circle, clipboard, clock, code, columns, command, compass, corner-down-left, corner-down-right, corner-left-down, corner-left-up, corner-right-down, corner-right-up, corner-up-left, corner-up-right, crosshair, database, divide-circle, divide-square, dollar-sign, download, external-link, feather, frown, hash, headphones, help-circle, info, italic, key, layout, life-buoy, link-2, link, loader, lock, log-in, log-out, maximize, meh, minimize, minimize-2, minus-circle, minus-square, minus, monitor, moon, more-horizontal, more-vertical, move, music, navigation-2, navigation, octagon, pause-circle, percent, plus-circle, plus-square, plus, power, radio, rss, search, server, share, shopping-bag, sidebar, smartphone, smile, square, table-2, tablet, target, terminal, trash-2, trash, triangle, tv, type, upload, x-circle, x-octagon, x-square, x, zoom-in, zoom-out
 *
 * The MIT License (MIT) (for the icons listed above)
 *
 * Copyright (c) 2013-present Cole Bemis
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 */

export type Shape = ReadonlyArray<readonly [tag: string, attrs: Readonly<Record<string, string>>]>;

export const ICON_SHAPES = {
  ArrowLeft: [["path", {"d": "m12 19-7-7 7-7"}], ["path", {"d": "M19 12H5"}]],
  Banknote: [["rect", {"width": "20", "height": "12", "x": "2", "y": "6", "rx": "2"}], ["circle", {"cx": "12", "cy": "12", "r": "2"}], ["path", {"d": "M6 12h.01M18 12h.01"}]],
  Building2: [["path", {"d": "M6 22V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v18Z"}], ["path", {"d": "M6 12H4a2 2 0 0 0-2 2v6a2 2 0 0 0 2 2h2"}], ["path", {"d": "M18 9h2a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-2"}], ["path", {"d": "M10 6h4"}], ["path", {"d": "M10 10h4"}], ["path", {"d": "M10 14h4"}], ["path", {"d": "M10 18h4"}]],
  Calendar: [["path", {"d": "M8 2v3"}], ["path", {"d": "M16 2v3"}], ["rect", {"x": "3", "y": "3", "width": "18", "height": "18", "rx": "2"}], ["path", {"d": "M3 9h18"}]],
  CalendarCheck: [["path", {"d": "M8 2v3"}], ["path", {"d": "M16 2v3"}], ["rect", {"x": "3", "y": "3", "width": "18", "height": "18", "rx": "2"}], ["path", {"d": "M3 9h18"}], ["path", {"d": "m9 15 2 2 4-4"}]],
  CalendarDays: [["path", {"d": "M8 2v3"}], ["path", {"d": "M16 2v3"}], ["rect", {"x": "3", "y": "3", "width": "18", "height": "18", "rx": "2"}], ["path", {"d": "M3 9h18"}], ["path", {"d": "M8 13h.01"}], ["path", {"d": "M12 13h.01"}], ["path", {"d": "M16 13h.01"}], ["path", {"d": "M8 17h.01"}], ["path", {"d": "M12 17h.01"}], ["path", {"d": "M16 17h.01"}]],
  CalendarRange: [["rect", {"x": "3", "y": "3", "width": "18", "height": "18", "rx": "2"}], ["path", {"d": "M16 2v3"}], ["path", {"d": "M3 9h18"}], ["path", {"d": "M8 2v3"}], ["path", {"d": "M17 13h-6"}], ["path", {"d": "M13 17H7"}], ["path", {"d": "M7 13h.01"}], ["path", {"d": "M17 17h.01"}]],
  ChevronDown: [["path", {"d": "m6 9 6 6 6-6"}]],
  ChevronLeft: [["path", {"d": "m15 18-6-6 6-6"}]],
  ChevronRight: [["path", {"d": "m9 18 6-6-6-6"}]],
  ChevronUp: [["path", {"d": "m18 15-6-6-6 6"}]],
  CircleAlert: [["circle", {"cx": "12", "cy": "12", "r": "10"}], ["line", {"x1": "12", "x2": "12", "y1": "8", "y2": "12"}], ["line", {"x1": "12", "x2": "12.01", "y1": "16", "y2": "16"}]],
  CircleCheck: [["circle", {"cx": "12", "cy": "12", "r": "10"}], ["path", {"d": "m16 9-5.5 5.5L8 12"}]],
  CircleDashed: [["path", {"d": "M10.1 2.182a10 10 0 0 1 3.8 0"}], ["path", {"d": "M13.9 21.818a10 10 0 0 1-3.8 0"}], ["path", {"d": "M17.609 3.721a10 10 0 0 1 2.69 2.7"}], ["path", {"d": "M2.182 13.9a10 10 0 0 1 0-3.8"}], ["path", {"d": "M20.279 17.609a10 10 0 0 1-2.7 2.69"}], ["path", {"d": "M21.818 10.1a10 10 0 0 1 0 3.8"}], ["path", {"d": "M3.721 6.391a10 10 0 0 1 2.7-2.69"}], ["path", {"d": "M6.391 20.279a10 10 0 0 1-2.69-2.7"}]],
  ClipboardList: [["rect", {"width": "8", "height": "4", "x": "8", "y": "2", "rx": "1", "ry": "1"}], ["path", {"d": "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"}], ["path", {"d": "M12 11h4"}], ["path", {"d": "M12 16h4"}], ["path", {"d": "M8 11h.01"}], ["path", {"d": "M8 16h.01"}]],
  Clock: [["circle", {"cx": "12", "cy": "12", "r": "10"}], ["path", {"d": "M12 6v6l4 2"}]],
  CloudOff: [["path", {"d": "M10.94 5.274A7 7 0 0 1 15.71 10h1.79a4.5 4.5 0 0 1 4.222 6.057"}], ["path", {"d": "M18.796 18.81A4.5 4.5 0 0 1 17.5 19H9A7 7 0 0 1 5.79 5.78"}], ["path", {"d": "m2 2 20 20"}]],
  Coins: [["path", {"d": "M13.744 17.736a6 6 0 1 1-7.48-7.48"}], ["path", {"d": "M15 6h1v4"}], ["path", {"d": "m6.134 14.768.866-.5 2 3.464"}], ["circle", {"cx": "16", "cy": "8", "r": "6"}]],
  CreditCard: [["rect", {"width": "20", "height": "14", "x": "2", "y": "5", "rx": "2"}], ["line", {"x1": "2", "x2": "22", "y1": "10", "y2": "10"}], ["path", {"d": "M6 14h2"}]],
  DoorOpen: [["path", {"d": "M13 4h3a2 2 0 0 1 2 2v14"}], ["path", {"d": "M2 20h3"}], ["path", {"d": "M13 20h9"}], ["path", {"d": "M10 12v.01"}], ["path", {"d": "M13 4.562v16.157a1 1 0 0 1-1.242.97L5 20V5.562a2 2 0 0 1 1.515-1.94l4-1A2 2 0 0 1 13 4.561Z"}]],
  Download: [["path", {"d": "M12 15V3"}], ["path", {"d": "M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"}], ["path", {"d": "m7 10 5 5 5-5"}]],
  FileCheck: [["path", {"d": "M6 22a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h8a2.4 2.4 0 0 1 1.704.706l3.588 3.588A2.4 2.4 0 0 1 20 8v12a2 2 0 0 1-2 2z"}], ["path", {"d": "M14 2v5a1 1 0 0 0 1 1h5"}], ["path", {"d": "m9 15 2 2 4-4"}]],
  FlaskConical: [["path", {"d": "M14 2v6a2 2 0 0 0 .245.96l5.51 10.08A2 2 0 0 1 18 22H6a2 2 0 0 1-1.755-2.96l5.51-10.08A2 2 0 0 0 10 8V2"}], ["path", {"d": "M6.453 15h11.094"}], ["path", {"d": "M8.5 2h7"}]],
  Hourglass: [["path", {"d": "M5 22h14"}], ["path", {"d": "M5 2h14"}], ["path", {"d": "M17 22v-4.172a2 2 0 0 0-.586-1.414L12 12l-4.414 4.414A2 2 0 0 0 7 17.828V22"}], ["path", {"d": "M7 2v4.172a2 2 0 0 0 .586 1.414L12 12l4.414-4.414A2 2 0 0 0 17 6.172V2"}]],
  Inbox: [["polyline", {"points": "22 12 16 12 14 15 10 15 8 12 2 12"}], ["path", {"d": "M5.45 5.11 2 12v6a2 2 0 0 0 2 2h16a2 2 0 0 0 2-2v-6l-3.45-6.89A2 2 0 0 0 16.76 4H7.24a2 2 0 0 0-1.79 1.11z"}]],
  Info: [["circle", {"cx": "12", "cy": "12", "r": "10"}], ["path", {"d": "M12 16v-4"}], ["path", {"d": "M12 8h.01"}]],
  Layers: [["path", {"d": "M12.83 2.18a2 2 0 0 0-1.66 0L2.6 6.08a1 1 0 0 0 0 1.83l8.58 3.91a2 2 0 0 0 1.66 0l8.58-3.9a1 1 0 0 0 0-1.83z"}], ["path", {"d": "M2 12a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 12"}], ["path", {"d": "M2 17a1 1 0 0 0 .58.91l8.6 3.91a2 2 0 0 0 1.65 0l8.58-3.9A1 1 0 0 0 22 17"}]],
  LayoutGrid: [["rect", {"width": "7", "height": "7", "x": "3", "y": "3", "rx": "1"}], ["rect", {"width": "7", "height": "7", "x": "14", "y": "3", "rx": "1"}], ["rect", {"width": "7", "height": "7", "x": "14", "y": "14", "rx": "1"}], ["rect", {"width": "7", "height": "7", "x": "3", "y": "14", "rx": "1"}]],
  ListFilter: [["path", {"d": "M2 5h20"}], ["path", {"d": "M6 12h12"}], ["path", {"d": "M9 19h6"}]],
  LogIn: [["path", {"d": "m10 17 5-5-5-5"}], ["path", {"d": "M15 12H3"}], ["path", {"d": "M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"}]],
  Mail: [["path", {"d": "m22 7-8.991 5.727a2 2 0 0 1-2.009 0L2 7"}], ["rect", {"x": "2", "y": "4", "width": "20", "height": "16", "rx": "2"}]],
  MapPin: [["path", {"d": "M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"}], ["circle", {"cx": "12", "cy": "10", "r": "3"}]],
  Minus: [["path", {"d": "M5 12h14"}]],
  Nfc: [["path", {"d": "M6 8.32a7.43 7.43 0 0 1 0 7.36"}], ["path", {"d": "M9.46 6.21a11.76 11.76 0 0 1 0 11.58"}], ["path", {"d": "M12.91 4.1a15.91 15.91 0 0 1 .01 15.8"}], ["path", {"d": "M16.37 2a20.16 20.16 0 0 1 0 20"}]],
  NotebookPen: [["path", {"d": "M13.4 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-7.4"}], ["path", {"d": "M2 6h4"}], ["path", {"d": "M2 10h4"}], ["path", {"d": "M2 14h4"}], ["path", {"d": "M2 18h4"}], ["path", {"d": "M21.378 5.626a1 1 0 1 0-3.004-3.004l-5.01 5.012a2 2 0 0 0-.506.854l-.837 2.87a.5.5 0 0 0 .62.62l2.87-.837a2 2 0 0 0 .854-.506z"}]],
  PanelsTopLeft: [["rect", {"width": "18", "height": "18", "x": "3", "y": "3", "rx": "2"}], ["path", {"d": "M3 9h18"}], ["path", {"d": "M9 21V9"}]],
  Plus: [["path", {"d": "M5 12h14"}], ["path", {"d": "M12 5v14"}]],
  Radio: [["path", {"d": "M16.247 7.761a6 6 0 0 1 0 8.478"}], ["path", {"d": "M19.075 4.933a10 10 0 0 1 0 14.134"}], ["path", {"d": "M4.925 19.067a10 10 0 0 1 0-14.134"}], ["path", {"d": "M7.753 16.239a6 6 0 0 1 0-8.478"}], ["circle", {"cx": "12", "cy": "12", "r": "2"}]],
  Receipt: [["path", {"d": "M12 17V7"}], ["path", {"d": "M16 8h-6a2 2 0 0 0 0 4h4a2 2 0 0 1 0 4H8"}], ["path", {"d": "M4 3a1 1 0 0 1 1-1 1.3 1.3 0 0 1 .7.2l.933.6a1.3 1.3 0 0 0 1.4 0l.934-.6a1.3 1.3 0 0 1 1.4 0l.933.6a1.3 1.3 0 0 0 1.4 0l.933-.6a1.3 1.3 0 0 1 1.4 0l.934.6a1.3 1.3 0 0 0 1.4 0l.933-.6A1.3 1.3 0 0 1 19 2a1 1 0 0 1 1 1v18a1 1 0 0 1-1 1 1.3 1.3 0 0 1-.7-.2l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.934.6a1.3 1.3 0 0 1-1.4 0l-.933-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-1.4 0l-.934-.6a1.3 1.3 0 0 0-1.4 0l-.933.6a1.3 1.3 0 0 1-.7.2 1 1 0 0 1-1-1z"}]],
  ScanLine: [["path", {"d": "M3 7V5a2 2 0 0 1 2-2h2"}], ["path", {"d": "M17 3h2a2 2 0 0 1 2 2v2"}], ["path", {"d": "M21 17v2a2 2 0 0 1-2 2h-2"}], ["path", {"d": "M7 21H5a2 2 0 0 1-2-2v-2"}], ["path", {"d": "M7 12h10"}]],
  Search: [["circle", {"cx": "11", "cy": "11", "r": "8"}], ["path", {"d": "m21 21-4.3-4.3"}]],
  Send: [["path", {"d": "M14.536 21.686a.5.5 0 0 0 .937-.024l6.5-19a.496.496 0 0 0-.635-.635l-19 6.5a.5.5 0 0 0-.024.937l7.93 3.18a2 2 0 0 1 1.112 1.11z"}], ["path", {"d": "m21.854 2.147-10.94 10.939"}]],
  Tag: [["path", {"d": "M12.586 2.586A2 2 0 0 0 11.172 2H4a2 2 0 0 0-2 2v7.172a2 2 0 0 0 .586 1.414l8.704 8.704a2.426 2.426 0 0 0 3.42 0l6.58-6.58a2.426 2.426 0 0 0 0-3.42z"}], ["circle", {"cx": "7.5", "cy": "7.5", "r": ".5", "fill": "currentColor"}]],
  Undo2: [["path", {"d": "M9 14 4 9l5-5"}], ["path", {"d": "M4 9h10.5a5.5 5.5 0 0 1 5.5 5.5a5.5 5.5 0 0 1-5.5 5.5H11"}]],
  UserX: [["path", {"d": "M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2"}], ["circle", {"cx": "9", "cy": "7", "r": "4"}], ["line", {"x1": "17", "x2": "22", "y1": "8", "y2": "13"}], ["line", {"x1": "22", "x2": "17", "y1": "8", "y2": "13"}]],
  Wallet: [["path", {"d": "M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1"}], ["path", {"d": "M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4"}]],
  X: [["path", {"d": "M18 6 6 18"}], ["path", {"d": "m6 6 12 12"}]],
  Zap: [["path", {"d": "M15.914 4a1.5 1.5 0 00-2.474-1.561l-9 9A1.5 1.5 0 005.5 14h4.002a.5.5 0 01.471.666L8.086 20a1.5 1.5 0 002.475 1.56l9-9A1.5 1.5 0 0018.5 10h-3.997a.5.5 0 01-.472-.667z"}]],
} as const satisfies Record<string, Shape>;

export type IconName = keyof typeof ICON_SHAPES;

export const ICON_NAMES = Object.keys(ICON_SHAPES) as IconName[];

/** Controls and nav: 16–18 px. Leading icons in lists: about 20 px. */
export const ICON_SIZE = { control: 16, nav: 18, leading: 20 } as const;

/** A nav / object icon: one lucide shape, or the Refund composite. */
export type IconSpec = IconName | 'Refund';
