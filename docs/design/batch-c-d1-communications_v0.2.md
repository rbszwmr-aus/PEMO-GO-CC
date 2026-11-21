# Communications port recovery — Batch C D1

- Version: 0.2
- Date: 2026-11-20 (AEDT, Australia/Sydney)
- Changelog:
  - 0.2: there is no worker or scheduled consumer of the communications port.
    The HTTP/worker adapter alias files have been removed. HTTP mail routes
    call `dispatchMailBatch` / `dispatchClaimedMail` directly. An unconfigured
    port is mapped to HTTP 503 `communications-unavailable` problem+json.
  - 0.1: initial recovery note.

Notice and invoice sends go through the application-layer communications port
(`apps/api/src/communications`). Durable rows stay in `strata.email_outbox`
behind a compatibility adapter. The event outbox (`platform.outbox_message`)
is a different path and is out of scope.

There is no worker or scheduled mail path in this tree. HTTP routes use the
shared claim-and-dispatch policy (`dispatchMailBatch` / `dispatchClaimedMail`).
Fake and unconfigured adapters expose the same command surface.

## Errors and recovery

- `CommunicationsUnavailableError` (`communications_unavailable`): the port is
  unconfigured. HTTP maps this to **503** `application/problem+json`
  (`https://pemo.local/problems/communications-unavailable`). This is not a
  successful log-only send and not a silent no-op. Configure the strata
  compatibility adapter (or a later real store) and retry the authorised send.
- `failed`: pre-accept transport failure. The row may return to queued on an
  authorised retry or resend.
- `unknown`: acknowledgement is uncertain, or the sending window has expired.
  Do not auto-retry. A manual resend is a new generation.
- `accepted` / `log-only`: terminal. Do not auto-retry.

Charge and notice *content* is still read from the existing query ports
(`strataReads`, `staffNotices`). Those are not mail storage.
