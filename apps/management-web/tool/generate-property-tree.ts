/**
 * Writes tests/fixtures/management-web/mob-s3-properties/tree.json
 * from the Wing Fu Garden seed basis. Do not hand-edit the JSON.
 */

import { readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { buildWingFuGardenTreeNodes } from './wing-fu-garden-tree.ts';

const ROOT = fileURLToPath(new URL('../../..', import.meta.url));
const FIXTURE = join(ROOT, 'tests/fixtures/management-web/mob-s3-properties/tree.json');
const OPENAPI = join(ROOT, 'packages/api-contracts/management-web/openapi.yaml');

const authoredVersion =
  readFileSync(OPENAPI, 'utf8').match(/^ {2}version: (.+)$/m)?.[1]?.trim() ?? '2.4.0';

const body = {
  meta: {
    correlationId: '2b3c4d5e-0000-4000-8000-000000000010',
    contractVersion: authoredVersion,
    generatedAt: '2026-08-12T09:56:00+08:00',
  },
  nodes: buildWingFuGardenTreeNodes(),
};

writeFileSync(FIXTURE, `${JSON.stringify(body, null, 2)}\n`);
console.log(`wrote ${FIXTURE} (${body.nodes.length} nodes)`);
