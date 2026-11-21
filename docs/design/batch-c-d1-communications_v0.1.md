# Communications port recovery — Batch C D1

Notice and invoice sends go through the application-layer communications port
(`apps/api/src/communications`). Durable rows stay in `strata.email_outbox`
behind a compatibility adapter. The event outbox (`platform.outbox_message`)
is a different path and is out of scope.

HTTP and worker dispatch share one claim-and-dispatch policy
(`dispatchMailBatch` / `dispatchClaimedMail`). Fake and unconfigured adapters
expose the same command surface.

## Errors and recovery

- `CommunicationsUnavailableError` (`communications_unavailable`): the port is
  unconfigured. This is not a successful log-only send and not a silent no-op.
  Configure the strata compatibility adapter (or a later real store) and retry
  the authorised send.
- `failed`: pre-accept transport failure. The row may return to queued on an
  authorised retry or resend.
- `unknown`: acknowledgement is uncertain, or the sending window has expired.
  Do not auto-retry. A manual resend is a new generation.
- `accepted` / `log-only`: terminal. Do not auto-retry.

Charge and notice *content* is still read from the existing query ports
(`strataReads`, `staffNotices`). Those are not mail storage.
