import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Locale } from '../../i18n/locale.ts';
import { t } from '../../i18n/locale.ts';
import { MESSAGES } from '../../i18n/messages.ts';
import { getMyVisitor, listMyVisitors, type DemoVisitor } from '../../data/visitors-client.ts';
import { Loading } from '../../components/StateNotice.tsx';
import { VisitorList } from './VisitorList.tsx';
import { VisitorCreate } from './VisitorCreate.tsx';
import { VisitorDetail } from './VisitorDetail.tsx';

function sortNewestFirst(visitors: DemoVisitor[]): DemoVisitor[] {
  return [...visitors].sort((a, b) => {
    const ta = Date.parse(a.updatedAt || a.createdAt || '') || 0;
    const tb = Date.parse(b.updatedAt || b.createdAt || '') || 0;
    return tb - ta;
  });
}

export function VisitorPane({
  tab,
  visitorId,
  locale,
  onNavigate,
}: {
  tab: string;
  visitorId?: string;
  locale: Locale;
  onNavigate: (next: { tab?: string; visitor?: string | null }) => void;
}) {
  const M = MESSAGES.visitorPortal;
  const [visitors, setVisitors] = useState<DemoVisitor[]>([]);
  const [source, setSource] = useState<'api' | 'local'>('local');
  const [detail, setDetail] = useState<DemoVisitor | null>(null);
  const [loading, setLoading] = useState(true);
  const [detailReady, setDetailReady] = useState(false);

  const ordered = useMemo(() => sortNewestFirst(visitors), [visitors]);

  const refreshList = useCallback(async () => {
    const res = await listMyVisitors();
    setVisitors(res.visitors);
    setSource(res.source);
    return res.visitors;
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

      if (visitorId) {
        const res = await getMyVisitor(visitorId);
        if (cancelled) return;
        setDetail(res.visitor);
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
      onNavigate({ tab: 'detail', visitor: sorted[0]!.visitorId });
    })();

    return () => {
      cancelled = true;
    };
  }, [tab, visitorId, refreshList, onNavigate]);

  const index = visitorId ? ordered.findIndex((x) => x.visitorId === visitorId) : -1;
  // ordered is newest-first → older = higher index, newer = lower index
  const hasPrev = index >= 0 && index < ordered.length - 1;
  const hasNext = index > 0;

  if (tab === 'create') {
    return (
      <VisitorCreate
        locale={locale}
        onCancel={() => onNavigate({ tab: 'list', visitor: null })}
        onCreated={(id) => onNavigate({ tab: 'detail', visitor: id })}
      />
    );
  }

  if (tab === 'detail') {
    if (loading || !detailReady) return <Loading locale={locale} />;

    if (!visitorId && ordered.length === 0) {
      return (
        <div className="pemo-panel" data-testid="portal-visitor-detail-empty">
          <h1 className="pemo-page-title">{t(M.detailEmptyTitle, locale)}</h1>
          <p className="pemo-note">{t(M.detailEmptyBody, locale)}</p>
          <p className="pemo-note">
            <button
              type="button"
              className="pemo-btn"
              data-testid="portal-visitor-empty-create"
              onClick={() => onNavigate({ tab: 'create', visitor: null })}
            >
              {t(M.createAction, locale)}
            </button>
          </p>
        </div>
      );
    }

    if (detail) {
      const positionLabel =
        index >= 0
          ? t(M.visitorPosition, locale)
              .replace('{current}', String(index + 1))
              .replace('{total}', String(ordered.length))
          : undefined;
      return (
        <VisitorDetail
          visitor={detail}
          source={source}
          locale={locale}
          onBack={() => onNavigate({ tab: 'list', visitor: null })}
          onUpdated={(next) => {
            setDetail(next);
            setVisitors((prev) => prev.map((v) => (v.visitorId === next.visitorId ? next : v)));
          }}
          hasPrev={hasPrev}
          hasNext={hasNext}
          {...(positionLabel ? { positionLabel } : {})}
          {...(hasPrev
            ? { onPrev: () => onNavigate({ tab: 'detail', visitor: ordered[index + 1]!.visitorId }) }
            : {})}
          {...(hasNext
            ? { onNext: () => onNavigate({ tab: 'detail', visitor: ordered[index - 1]!.visitorId }) }
            : {})}
        />
      );
    }

    return (
      <div className="pemo-panel" data-testid="portal-visitor-detail-missing">
        <h1 className="pemo-page-title">{t(M.detailEmptyTitle, locale)}</h1>
        <p className="pemo-note">{t(M.detailEmptyBody, locale)}</p>
        <p className="pemo-note">
          <button
            type="button"
            className="pemo-btn"
            data-testid="portal-visitor-back"
            onClick={() => onNavigate({ tab: 'list', visitor: null })}
          >
            {t(M.backToList, locale)}
          </button>
        </p>
      </div>
    );
  }

  if (loading) return <Loading locale={locale} />;

  return (
    <VisitorList
      visitors={ordered}
      source={source}
      locale={locale}
      onOpen={(id) => onNavigate({ tab: 'detail', visitor: id })}
      onCreate={() => onNavigate({ tab: 'create', visitor: null })}
    />
  );
}
