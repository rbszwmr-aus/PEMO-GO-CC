/**
 * THE ACT CLIENT — the notices write surface, in two implementations.
 *
 * `LiveNoticeActClient` sends the request the contract describes:
 *   POST /notices                          composeNotice   (client-keyed)
 *   POST /notices/{id}/{verb}              the seven transitions (derived-key on
 *                                          (noticeId, fromVersion))
 * and returns the response, the refusal, or offline — never a fabricated success.
 *
 * `CorpusNoticeActClient` is fixture mode. The corpus carries one lifecycle,
 * walked once and recorded at every step: the request that was sent and the
 * response that came back, as consecutive states of one world. In fixture mode an
 * act RETURNS THE RECORDED RESPONSE FOR THAT ACT. It does not evaluate the request
 * and it cannot refuse — the refusal fixtures are states, reached by URL like every
 * other state. This is stated on screen (s5.recordedResponseNote) so a reader never
 * mistakes the recorded world for a server.
 *
 * NEVER OPTIMISTIC. Neither implementation changes any state the client holds; the
 * caller navigates on the RESPONSE, and the detail is fetched again rather than
 * patched.
 */

import { CORPUS } from './corpus.g.ts';
import { isLiveProblem } from './live-client.ts';
import { maySendCredentials } from './live-config.ts';
import type {
  ComposeNoticeRequest, NoticeActResponse, NoticeTransition, NoticeTransitionRequest, Problem,
} from './types.ts';

export type ActResult =
  | { readonly kind: 'recorded'; readonly data: NoticeActResponse }
  | { readonly kind: 'problem'; readonly problem: Problem }
  | { readonly kind: 'offline' };

export interface NoticeActClient {
  compose(body: ComposeNoticeRequest, clientKey: string): Promise<ActResult>;
  transition(op: NoticeTransition, noticeId: string, body: NoticeTransitionRequest): Promise<ActResult>;
}

/** `reviseNotice` → `revise`: the contract's path segment IS the operationId minus its noun. */
export const verbOf = (op: NoticeTransition): string => op.replace(/Notice$/, '');

export const NOTICES_PATH = '/api/management-web/v0/notices';

const UNREADABLE = CORPUS['problems/internal-error.json'] as Problem;

export class LiveNoticeActClient implements NoticeActClient {
  // A plain field, not a parameter property: node's strip-only TypeScript mode (which
  // the report tools run under) cannot strip `private readonly` on a parameter.
  private readonly config: { baseUrl: string; token: string; fetch?: typeof fetch; pageOrigin?: string };
  constructor(config: { baseUrl: string; token: string; fetch?: typeof fetch; pageOrigin?: string }) {
    this.config = config;
  }

  private mayAttachAuthorization(): boolean {
    const origin = this.config.pageOrigin;
    if (origin === undefined || origin === '') return true;
    return maySendCredentials(this.config.baseUrl, origin);
  }

  compose(body: ComposeNoticeRequest, clientKey: string): Promise<ActResult> {
    return this.post(NOTICES_PATH, body, { 'Idempotency-Key': clientKey });
  }

  transition(op: NoticeTransition, noticeId: string, body: NoticeTransitionRequest): Promise<ActResult> {
    return this.post(`${NOTICES_PATH}/${encodeURIComponent(noticeId)}/${verbOf(op)}`, body, {});
  }

  private async post(path: string, body: unknown, extra: Record<string, string>): Promise<ActResult> {
    const headers: Record<string, string> = {
      Accept: 'application/json', 'Content-Type': 'application/json', ...extra,
    };
    // A missing token is still a request: the server's 401 is the honest answer.
    if (this.config.token && this.mayAttachAuthorization()) headers['Authorization'] = `Bearer ${this.config.token}`;
    const doFetch = this.config.fetch ?? fetch;
    let response: Response;
    try {
      response = await doFetch(`${this.config.baseUrl}${path}`, { method: 'POST', headers, body: JSON.stringify(body) });
    } catch {
      return { kind: 'offline' };
    }
    let parsed: unknown;
    try {
      parsed = await response.json();
    } catch {
      return { kind: 'problem', problem: UNREADABLE };
    }
    if (response.status >= 400) {
      return { kind: 'problem', problem: isLiveProblem(parsed) ? parsed : UNREADABLE };
    }
    return { kind: 'recorded', data: parsed as NoticeActResponse };
  }
}

export class CorpusNoticeActClient implements NoticeActClient {
  async compose(): Promise<ActResult> {
    return { kind: 'recorded', data: CORPUS['notices/compose.json'] as NoticeActResponse };
  }

  async transition(op: NoticeTransition): Promise<ActResult> {
    const file = `notices/${verbOf(op)}.json`;
    const data = CORPUS[file];
    // Every transition has a recorded response in the frozen corpus. If one is ever
    // missing this must fail loudly rather than render a plausible nothing.
    if (data === undefined) throw new Error(`no recorded response for ${op}: ${file} is not in the corpus`);
    return { kind: 'recorded', data: data as NoticeActResponse };
  }
}
