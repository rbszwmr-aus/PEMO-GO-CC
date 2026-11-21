/**
 * Administration → Email configuration. Fixture-first SMTP settings.
 *
 * Persist is an in-memory session store (same pattern as invoice-sends).
 * No localStorage / sessionStorage / cookies — the credential-storage guard
 * forbids those APIs. Live secrets should move to server env later.
 *
 * NOT a management-web contract operation. operationIds stay empty.
 */

import type { AdminEmailConfig, AdminEmailEncryption } from './types.ts';

const DEFAULT: AdminEmailConfig = {
  smtpHost: 'smtp.wingfu.example',
  smtpPort: 587,
  encryption: 'starttls',
  username: 'invoices@wingfu.example',
  smtpPass: 'fixture-smtp-pass',
  fromName: 'Wing Fu Garden Management',
  fromAddress: 'invoices@wingfu.example',
  replyTo: '',
  testRecipient: 'alex.chen@wingfu.example',
};

let current: AdminEmailConfig = { ...DEFAULT };
let revision = 0;
const listeners = new Set<() => void>();

function emit(): void {
  revision += 1;
  for (const l of listeners) l();
}

export const ADMIN_EMAIL_DEFAULT: AdminEmailConfig = { ...DEFAULT };

export const ADMIN_EMAIL_CORPUS: Readonly<Record<string, unknown>> = {
  'admin-email/default.json': ADMIN_EMAIL_DEFAULT,
};

export function getAdminEmailConfig(): AdminEmailConfig {
  return { ...current };
}

export function saveAdminEmailConfig(next: AdminEmailConfig): AdminEmailConfig {
  current = normalizeAdminEmailConfig(next);
  emit();
  return getAdminEmailConfig();
}

export function resetAdminEmailConfig(): void {
  current = { ...DEFAULT };
  emit();
}

export function subscribeAdminEmailConfig(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export function adminEmailRevision(): number {
  return revision;
}

export function normalizeAdminEmailConfig(input: Partial<AdminEmailConfig>): AdminEmailConfig {
  const encryption = isEncryption(input.encryption) ? input.encryption : DEFAULT.encryption;
  const port = Number(input.smtpPort);
  return {
    smtpHost: (input.smtpHost ?? DEFAULT.smtpHost).trim(),
    smtpPort: Number.isFinite(port) && port > 0 ? Math.floor(port) : DEFAULT.smtpPort,
    encryption,
    username: (input.username ?? DEFAULT.username).trim(),
    smtpPass: input.smtpPass ?? DEFAULT.smtpPass,
    fromName: (input.fromName ?? DEFAULT.fromName).trim(),
    fromAddress: (input.fromAddress ?? DEFAULT.fromAddress).trim(),
    replyTo: (input.replyTo ?? DEFAULT.replyTo).trim(),
    testRecipient: (input.testRecipient ?? DEFAULT.testRecipient).trim(),
  };
}

function isEncryption(value: unknown): value is AdminEmailEncryption {
  return value === 'none' || value === 'starttls' || value === 'tls';
}
