/**
 * A notice’s title by id, for the places that hold only the id (the acknowledgements page, the
 * “recorded” panel). The same choice the list makes: Chinese shows the title in its script (简 converted
 * from the Traditional one), English the English one. Null when the id is not in the fixture lists.
 */
import { CORPUS } from './corpus.g.ts';
import { WFG_NOTICE_ROWS } from './notices-wfg-corpus.ts';
import { t, type Locale } from '../i18n/locale.ts';

interface Titled { noticeId: string; titleEn: string; titleZhHant: string }

function fixtureLists(): readonly Titled[] {
  const mob = (CORPUS['mob-s5-notices/list.json'] as unknown as { notices?: Titled[] } | undefined)?.notices ?? [];
  return [...WFG_NOTICE_ROWS, ...mob];
}

export function noticeTitleFor(noticeId: string | null | undefined, locale: Locale): string | null {
  if (!noticeId) return null;
  const n = fixtureLists().find((x) => x.noticeId === noticeId);
  if (!n) return null;
  return t({ en: n.titleEn, 'zh-Hant': n.titleZhHant }, locale);
}
