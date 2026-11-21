import { useEffect, useState } from 'react';
import { FrontCounterError, getFrontCounterClient, type Visit } from '../data/front-counter-client.ts';

export interface DeskVisits {
  visits: Visit[];
  /** Why today’s log could not be read: the session was refused, or anything else. Null when it loaded. */
  failure: 'session' | 'other' | null;
}

/** Today’s front-counter visits: re-read whenever the client’s log changes. */
export function useDeskVisits(): DeskVisits {
  const [state, setState] = useState<DeskVisits>({ visits: [], failure: null });
  useEffect(() => {
    const client = getFrontCounterClient();
    let alive = true;
    const load = () => {
      client.listToday().then(
        (visits) => { if (alive) setState({ visits, failure: null }); },
        (err: unknown) => {
          if (alive) setState({ visits: [], failure: err instanceof FrontCounterError && err.status === 401 ? 'session' : 'other' });
        },
      );
    };
    load();
    const off = client.subscribe(load);
    return () => { alive = false; off(); };
  }, []);
  return state;
}

/** Which source the front-counter client settled on, or null while it is still finding out. */
export function useFrontCounterSource(): 'fixture' | 'live' | null {
  const [kind, setKind] = useState<'fixture' | 'live' | null>(null);
  useEffect(() => {
    let alive = true;
    void getFrontCounterClient().ready.then((k) => { if (alive) setKind(k); });
    return () => { alive = false; };
  }, []);
  return kind;
}
