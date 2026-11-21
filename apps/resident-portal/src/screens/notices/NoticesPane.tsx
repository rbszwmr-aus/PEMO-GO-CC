import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '../../i18n/locale.ts';
import { t } from '../../i18n/locale.ts';
import { MESSAGES } from '../../i18n/messages.ts';
import { getNotice, listNotices, type DemoNotice } from '../../data/notices-client.ts';
import { Loading } from '../../components/StateNotice.tsx';
import { NoticeList } from './NoticeList.tsx';
import { NoticeDetail } from './NoticeDetail.tsx';

function sortNewestFirst(notices: DemoNotice[]): DemoNotice[] {
  return [...notices].sort((a, b) => {
    const ta = Date.parse(a.publishedAt || '') || 0;
    const tb = Date.parse(b.publishedAt || '') || 0;
    return tb - ta;
  });
}

export function NoticesPane({
  tab,
  noticeId,
  locale,
  onNavigate,
}: {
  tab: string;
  noticeId?: string;
  locale: Locale;
  onNavigate: (next: { tab?: string; notice?: string | null }) => void;
}) {
  const M = MESSAGES.noticesPortal;
  const [notices, setNotices] = useState<DemoNotice[]>([]);
  const [source, setSource] = useState<'api' | 'local'>('local');
  const [detail, setDetail] = useState<DemoNotice | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailReady, setDetailReady] = useState(false);

  const ordered = useMemo(() => sortNewestFirst(notices), [notices]);

  const refreshList = useCallback(async () => {
    const res = await listNotices();
    setNotices(res.notices);
    setSource(res.source);
    return res.notices;
  }, []);

  useEffect(() => {
    if (tab === 'list') {
      setLoading(true);
      void refreshList().finally(() => setLoading(false));
    }
  }, [tab, refreshList]);

  useEffect(() => {
    if (tab !== 'detail') {
      setDetailReady(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setDetailReady(false);

    void (async () => {
      const list = await refreshList();
      if (cancelled) return;
      const sorted = sortNewestFirst(list);

      if (noticeId) {
        const res = await getNotice(noticeId);
        if (cancelled) return;
        setDetail(res.notice);
        setSource(res.source);
        setDetailReady(true);
        setLoading(false);
        return;
      }

      if (sorted.length === 0) {
        setDetail(null);
        setDetailReady(true);
        setLoading(false);
        return;
      }

      setLoading(false);
      onNavigate({ tab: 'detail', notice: sorted[0]!.noticeId });
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, noticeId, refreshList, onNavigate]);

  const index = noticeId ? ordered.findIndex((x) => x.noticeId === noticeId) : -1;
  // ordered is newest-first → older = higher index, newer = lower index
  const hasPrev = index >= 0 && index < ordered.length - 1;
  const hasNext = index > 0;

  if (tab === 'detail') {
    if (loading || !detailReady) return <Loading locale={locale} />;

    if (!noticeId && ordered.length === 0) {
      return (
        <div className="pemo-panel" data-testid="portal-notice-detail-empty">
          <h1 className="pemo-page-title">{t(M.detailEmptyTitle, locale)}</h1>
          <p className="pemo-note">{t(M.detailEmptyBody, locale)}</p>
          <p className="pemo-note">
            <button
              type="button"
              className="pemo-btn"
              data-testid="portal-notice-back"
              onClick={() => onNavigate({ tab: 'list', notice: null })}
            >
              {t(M.backToList, locale)}
            </button>
          </p>
        </div>
      );
    }

    if (detail) {
      const positionLabel =
        index >= 0
          ? t(M.noticePosition, locale)
              .replace('{current}', String(index + 1))
              .replace('{total}', String(ordered.length))
          : undefined;
      return (
        <NoticeDetail
          notice={detail}
          source={source}
          locale={locale}
          onBack={() => onNavigate({ tab: 'list', notice: null })}
          hasPrev={hasPrev}
          hasNext={hasNext}
          {...(positionLabel ? { positionLabel } : {})}
          {...(hasPrev
            ? { onPrev: () => onNavigate({ tab: 'detail', notice: ordered[index + 1]!.noticeId }) }
            : {})}
          {...(hasNext
            ? { onNext: () => onNavigate({ tab: 'detail', notice: ordered[index - 1]!.noticeId }) }
            : {})}
        />
      );
    }

    return (
      <div className="pemo-panel" data-testid="portal-notice-detail-missing">
        <h1 className="pemo-page-title">{t(M.detailEmptyTitle, locale)}</h1>
        <p className="pemo-note">{t(M.detailEmptyBody, locale)}</p>
        <p className="pemo-note">
          <button
            type="button"
            className="pemo-btn"
            data-testid="portal-notice-back"
            onClick={() => onNavigate({ tab: 'list', notice: null })}
          >
            {t(M.backToList, locale)}
          </button>
        </p>
      </div>
    );
  }

  if (loading) return <Loading locale={locale} />;

  return (
    <NoticeList
      notices={ordered}
      source={source}
      locale={locale}
      onOpen={(id) => onNavigate({ tab: 'detail', notice: id })}
    />
  );
}
