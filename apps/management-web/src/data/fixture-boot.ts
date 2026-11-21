/**
 * The fixture corpora the app renders from in fixture mode (and as the rail's tree in every mode), gathered in one
 * module so they ship as ONE chunk that `fixture-gate.ts` loads before the first render — not inside the entry bundle.
 * The corpus is proven genuine here, before anything renders: on this surface absent data is indistinguishable from
 * the empty state, so the app refuses to start rather than rendering plausible nothing.
 *
 * @version 0.1.0
 * @changelog
 *   0.1.0 (2026-11-20) New (initial-bundle work): moved out of app.tsx's static imports.
 */

import { CORPUS, assertCorpusIsGenuine } from './corpus.g.ts';
import { RESIDENTS_CORPUS } from './residents-corpus.ts';
import { HOUSEHOLDS_CORPUS } from './households-corpus.ts';
import { ADMIN_DIRECTORY_CORPUS } from './admin-directory-corpus.ts';
import { findWfgNoticeDetail, findWfgOutstanding, NOTICES_WFG_CORPUS } from './notices-wfg-corpus.ts';

assertCorpusIsGenuine();

export { CORPUS, RESIDENTS_CORPUS, HOUSEHOLDS_CORPUS, ADMIN_DIRECTORY_CORPUS, NOTICES_WFG_CORPUS, findWfgNoticeDetail, findWfgOutstanding };
