/**
 * Three interface languages: English, Traditional Chinese and Simplified Chinese.
 *
 * ADR-007 A6 left Simplified Chinese as an open question; PT closed it with the
 * 繁 / 简 / EN rule (COPA slice S01, clause 8.3.8). LocalizedText stays additive:
 * `zh-Hans` is optional on the contract's strings, because the Backend corpus and the
 * API return en + zh-Hant only. `t()` converts the zh-Hant text to Simplified for those
 * (hans.ts), never falls to English. Copy this app writes itself uses `Copy`, where all three are required.
 */

import { toHans } from './hans.ts';

export const LOCALES = ['en', 'zh-Hant', 'zh-Hans'] as const;
export type Locale = (typeof LOCALES)[number];
export const DEFAULT_LOCALE: Locale = 'en';

export function isLocale(v: string | null | undefined): v is Locale {
  return v === 'en' || v === 'zh-Hant' || v === 'zh-Hans';
}

/** The contract's string: English and Traditional are always present; Simplified when we author it. */
export interface LocalizedText {
  readonly en: string;
  readonly 'zh-Hant': string;
  readonly 'zh-Hans'?: string | undefined;
}

/** Client-authored copy: all three languages are required, so a missing one fails the type check. */
export interface Copy extends LocalizedText {
  readonly 'zh-Hans': string;
}

/** Build client-authored copy in all three languages. */
export const copy = (en: string, zhHant: string, zhHans: string): Copy => ({ en, 'zh-Hant': zhHant, 'zh-Hans': zhHans });

/** Either Chinese script, for layout and formatting choices that are the same in both. */
export const isChinese = (locale: Locale): boolean => locale !== 'en';

/** Pick the string for a locale. Simplified is the Backend’s own when it sends one, else the Traditional text converted (hans.ts); never English. */
export const t = (text: LocalizedText, locale: Locale): string =>
  locale === 'zh-Hans' ? (text['zh-Hans'] ?? toHans(text['zh-Hant'])) : text[locale];

/** Three-way choice for strings built in code (`${n} blocks`). */
export const pick = <T>(locale: Locale, choice: { en: T; 'zh-Hant': T; 'zh-Hans': T }): T => choice[locale];

/** The BCP-47 tag for Intl and for the lang attribute. */
export const bcp47 = (locale: Locale): string =>
  locale === 'zh-Hant' ? 'zh-Hant-HK' : locale === 'zh-Hans' ? 'zh-Hans-CN' : 'en-HK';
