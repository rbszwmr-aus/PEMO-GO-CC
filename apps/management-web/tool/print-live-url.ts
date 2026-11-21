/**
 * Print the URL that opens the live S3 tree on a vite preview of dist/.
 *
 * Requires PEMO_DEV_TOKEN_SECRET (or PEMO_LIVE_STAFF_TOKEN) and an origin
 * (PEMO_LIVE_PREVIEW_ORIGIN, default http://127.0.0.1:4173).
 */

import { mintStaffToken } from './dev-token.ts';

const origin = (process.env['PEMO_LIVE_PREVIEW_ORIGIN'] ?? 'http://127.0.0.1:4173').replace(/\/$/, '');
const secret = process.env['PEMO_DEV_TOKEN_SECRET'] ?? '';
const token = process.env['PEMO_LIVE_STAFF_TOKEN'] || (secret ? mintStaffToken(secret) : '');
const q = new URLSearchParams({ screen: 's3', state: 'tree', lang: 'en', source: 'live' });
if (token) q.set('token', token);
console.log(`${origin}/?${q.toString()}`);
