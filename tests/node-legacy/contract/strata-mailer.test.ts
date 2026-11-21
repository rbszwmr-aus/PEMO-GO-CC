/**
 * SMTP honesty. No socket is opened when SMTP env is absent, and a password
 * never appears in the detail string.
 */

import { strict as assert } from 'node:assert';
import test from 'node:test';
import { deliverMail, smtpConfigured } from '../../apps/api/dist/management/mailer.js';

test('missing SMTP env logs the message and says so', async () => {
  const previous = {
    SMTP_HOST: process.env['SMTP_HOST'],
    SMTP_URL: process.env['SMTP_URL'],
    SMTP_PASS: process.env['SMTP_PASS'],
  };
  delete process.env['SMTP_HOST'];
  delete process.env['SMTP_URL'];
  delete process.env['SMTP_PASS'];
  try {
    assert.equal(smtpConfigured(), false);
    const result = await deliverMail({
      to: 'desk@wingfu.example',
      from: 'invoices@wingfu.example',
      subject: 'Invoice INV-WFG-A1-202609',
      text: 'Outstanding: HKD 3280',
    });
    assert.equal(result.transport, 'log');
    assert.equal(result.status, 'log-only');
    assert.match(result.detail, /SMTP_HOST and SMTP_URL are unset/);
    assert.equal(result.detail.includes('secret-pass'), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});

test('a failed SMTP attempt redacts the password', async () => {
  const previous = {
    SMTP_HOST: process.env['SMTP_HOST'],
    SMTP_URL: process.env['SMTP_URL'],
    SMTP_PORT: process.env['SMTP_PORT'],
    SMTP_PASS: process.env['SMTP_PASS'],
  };
  process.env['SMTP_HOST'] = '127.0.0.1';
  process.env['SMTP_PORT'] = '1';
  process.env['SMTP_PASS'] = 's3cret-pass';
  delete process.env['SMTP_URL'];
  try {
    const result = await deliverMail({
      to: 'desk@wingfu.example',
      from: 'invoices@wingfu.example',
      subject: 'test',
      text: 'body',
    });
    assert.equal(result.transport, 'smtp');
    assert.equal(result.status, 'failed');
    assert.equal(result.detail.includes('s3cret-pass'), false);
  } finally {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) delete process.env[key];
      else process.env[key] = value;
    }
  }
});
