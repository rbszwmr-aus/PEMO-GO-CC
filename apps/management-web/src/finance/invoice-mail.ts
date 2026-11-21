/**
 * Invoice email delivery.
 *
 * Always write the Email outbox store. Real SMTP is optional and Node-only:
 *
 *   SMTP_HOST   required to enable a real send attempt
 *   SMTP_PORT   default 587 (or Administration Email config)
 *   SMTP_USER / SMTP_PASS   optional AUTH LOGIN
 *   SMTP_FROM   default invoices@wingfu.example (or Admin From address)
 *   SMTP_URL    smtp://user:pass@host:port  (alternative to the split vars)
 *
 * Administration → Email supplies From / SMTP values when saved in this
 * session. The Vite SPA has no sockets; it records outbox rows. Live secrets
 * should move to server env — do not keep SMTP values in the browser.
 * Gmail MCP is never required.
 */

import { getAdminEmailConfig } from '../data/admin-email-corpus.ts';
import type { AdminEmailConfig } from '../data/types.ts';
import type { OutboxStatus } from '../data/finance-fixtures.ts';

export interface InvoiceEmailDraft {
  to: string;
  from: string;
  replyTo?: string;
  subject: string;
  text: string;
  attachmentName: string;
  attachmentBytes: Uint8Array;
}

export interface SmtpSettings {
  host: string;
  port: number;
  encryption: AdminEmailConfig['encryption'];
  username: string;
  smtpPass: string;
  fromAddress: string;
  fromName: string;
  replyTo: string;
}

function env(name: string): string | undefined {
  if (typeof process === 'undefined' || !process.env) return undefined;
  const v = process.env[name];
  return v && v.length > 0 ? v : undefined;
}

function isNodeProcess(): boolean {
  return typeof process !== 'undefined' && Boolean(process.versions?.node);
}

export function smtpEnvPresent(): boolean {
  return Boolean(env('SMTP_HOST') || env('SMTP_URL'));
}

export function smtpConfigured(): boolean {
  return smtpEnvPresent();
}

function parseSmtpUrl(url: string): Partial<SmtpSettings> {
  try {
    const u = new URL(url);
    const port = u.port ? Number(u.port) : u.protocol === 'smtps:' ? 465 : 587;
    return {
      host: u.hostname,
      port,
      encryption: u.protocol === 'smtps:' ? 'tls' : 'starttls',
      username: decodeURIComponent(u.username),
      smtpPass: decodeURIComponent(u.password),
    };
  } catch {
    return {};
  }
}

/** Admin Email config first, then SMTP_* env, then Wing Fu fixture defaults. */
export function resolveSmtpSettings(override?: Partial<AdminEmailConfig>): SmtpSettings {
  const admin = override ? { ...getAdminEmailConfig(), ...override } : getAdminEmailConfig();
  const fromUrl = env('SMTP_URL') ? parseSmtpUrl(env('SMTP_URL')!) : {};
  const portFromEnv = env('SMTP_PORT') ? Number(env('SMTP_PORT')) : undefined;
  return {
    host: admin.smtpHost || fromUrl.host || env('SMTP_HOST') || '',
    port: admin.smtpPort || fromUrl.port || (portFromEnv && Number.isFinite(portFromEnv) ? portFromEnv : 587),
    encryption: admin.encryption || fromUrl.encryption || 'starttls',
    username: admin.username || fromUrl.username || env('SMTP_USER') || '',
    smtpPass: admin.smtpPass || fromUrl.smtpPass || env('SMTP_PASS') || '',
    fromAddress: admin.fromAddress || env('SMTP_FROM') || 'invoices@wingfu.example',
    fromName: admin.fromName || '',
    replyTo: admin.replyTo || '',
  };
}

export function formatFromAddress(settings: SmtpSettings = resolveSmtpSettings()): string {
  const addr = settings.fromAddress || 'invoices@wingfu.example';
  return settings.fromName ? `${settings.fromName} <${addr}>` : addr;
}

export function smtpFromAddress(): string {
  return formatFromAddress();
}

/**
 * Attempt SMTP when Node env SMTP_HOST / SMTP_URL is set. The browser bundle
 * and a Node process without those env vars always return `outbox`.
 *
 * Admin Email config supplies From / host / auth when present. Status `sent`
 * is reserved for a completed transport; `failed` means the attempt ran.
 */
export async function deliverInvoiceEmail(
  draft: InvoiceEmailDraft,
  configOverride?: Partial<AdminEmailConfig>,
): Promise<{
  status: OutboxStatus;
  delivery: 'outbox' | 'smtp';
}> {
  if (!smtpEnvPresent() || !isNodeProcess()) {
    return { status: 'outbox', delivery: 'outbox' };
  }
  const settings = resolveSmtpSettings(configOverride);
  if (!settings.host) {
    return { status: 'outbox', delivery: 'outbox' };
  }
  try {
    await attemptSmtpSend(draft, settings);
    return { status: 'sent', delivery: 'smtp' };
  } catch {
    return { status: 'failed', delivery: 'smtp' };
  }
}

/**
 * Minimal SMTP send for a Node job. Dynamic `node:net` / `node:tls` so the
 * SPA bundle does not pull sockets. Times out so a missing host cannot hang.
 */
export async function attemptSmtpSend(
  draft: InvoiceEmailDraft,
  settings: SmtpSettings,
): Promise<void> {
  if (!isNodeProcess()) throw new Error('SMTP is Node-only');
  const netSpec = 'node:' + 'net';
  const tlsSpec = 'node:' + 'tls';
  const net = await import(netSpec) as typeof import('node:net');
  const useTls = settings.encryption === 'tls';
  const tls = useTls ? await import(tlsSpec) as typeof import('node:tls') : null;

  await new Promise<void>((resolve, reject) => {
    const timeoutMs = 8000;
    let buffer = '';
    let step:
      | 'greet'
      | 'ehlo'
      | 'auth'
      | 'user'
      | 'smtpPass'
      | 'mail'
      | 'rcpt'
      | 'data'
      | 'body'
      | 'quit'
      | 'done' = 'greet';

    const socket = useTls && tls
      ? tls.connect({ host: settings.host, port: settings.port, servername: settings.host })
      : net.connect({ host: settings.host, port: settings.port });

    const timer = setTimeout(() => {
      socket.destroy();
      reject(new Error('SMTP timeout'));
    }, timeoutMs);

    const fail = (msg: string) => {
      clearTimeout(timer);
      socket.destroy();
      reject(new Error(msg));
    };

    const write = (line: string) => {
      socket.write(`${line}\r\n`);
    };

    const onLine = (line: string) => {
      const code = Number(line.slice(0, 3));
      if (step === 'greet') {
        if (code !== 220) return fail(`SMTP greet ${line}`);
        step = 'ehlo';
        write('EHLO pemo.local');
        return;
      }
      if (step === 'ehlo') {
        if (code !== 250) return fail(`SMTP EHLO ${line}`);
        if (line[3] === '-') return;
        if (settings.username) {
          step = 'auth';
          write('AUTH LOGIN');
          return;
        }
        step = 'mail';
        write(`MAIL FROM:<${settings.fromAddress}>`);
        return;
      }
      if (step === 'auth') {
        if (code !== 334) return fail(`SMTP AUTH ${line}`);
        step = 'user';
        write(Buffer.from(settings.username).toString('base64'));
        return;
      }
      if (step === 'user') {
        if (code !== 334) return fail(`SMTP AUTH user ${line}`);
        step = 'smtpPass';
        write(Buffer.from(settings.smtpPass).toString('base64'));
        return;
      }
      if (step === 'smtpPass') {
        if (code !== 235) return fail(`SMTP AUTH ${line}`);
        step = 'mail';
        write(`MAIL FROM:<${settings.fromAddress}>`);
        return;
      }
      if (step === 'mail') {
        if (code !== 250) return fail(`SMTP MAIL ${line}`);
        step = 'rcpt';
        write(`RCPT TO:<${draft.to}>`);
        return;
      }
      if (step === 'rcpt') {
        if (code !== 250 && code !== 251) return fail(`SMTP RCPT ${line}`);
        step = 'data';
        write('DATA');
        return;
      }
      if (step === 'data') {
        if (code !== 354) return fail(`SMTP DATA ${line}`);
        step = 'body';
        const reply = draft.replyTo || settings.replyTo;
        const body = [
          `From: ${draft.from}`,
          `To: ${draft.to}`,
          reply ? `Reply-To: ${reply}` : null,
          `Subject: ${draft.subject}`,
          'MIME-Version: 1.0',
          'Content-Type: text/plain; charset=utf-8',
          '',
          draft.text,
          draft.attachmentName
            ? `[attachment ${draft.attachmentName} ${draft.attachmentBytes.byteLength} bytes]`
            : '',
          '.',
        ].filter((row) => row !== null).join('\r\n');
        write(body);
        return;
      }
      if (step === 'body') {
        if (code !== 250) return fail(`SMTP body ${line}`);
        step = 'quit';
        write('QUIT');
        return;
      }
      if (step === 'quit') {
        step = 'done';
        clearTimeout(timer);
        socket.end();
        resolve();
      }
    };

    socket.on('data', (chunk: Buffer) => {
      buffer += chunk.toString('utf8');
      let idx = buffer.indexOf('\r\n');
      while (idx >= 0) {
        const line = buffer.slice(0, idx);
        buffer = buffer.slice(idx + 2);
        onLine(line);
        idx = buffer.indexOf('\r\n');
      }
    });
    socket.on('error', (err: Error) => fail(String(err)));
    socket.on('end', () => {
      if (step !== 'done') fail('SMTP connection ended');
    });
  });
}
