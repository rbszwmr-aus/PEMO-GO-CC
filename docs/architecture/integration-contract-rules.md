# Integration Contract Rules

- **Locked:** OpenAPI is the client/server contract source; domain events are versioned artifacts.
- **Proposed:** messages carry message ID, contract/version, occurred-at, source, correlation, causation, scope and payload.
- **Unresolved:** broker, outbox, registry, serialization and schema tooling; exact third-party payloads remain undefined. 2IoThub payloads are not in this category — `2IoThub` adapts to the contract PEMO defines, so they are specified under a formal API PID rather than discovered.

## Envelope and consumer semantics

| Field | Semantics and consumer obligation |
|---|---|
| `messageId` | Source-generated unique identifier within the source system and contract family; consumers persist a deduplication result for the contract-defined retention/lifetime and do not apply the same message twice |
| `contractName` / `contractVersion` | Identifies the schema and compatibility family; consumers validate payload against the declared version and reject or quarantine unsupported breaking versions |
| `occurredAt` | Domain occurrence time supplied by the source, with timezone/clock policy defined by the contract; consumers must not replace it with receipt time |
| `receivedAt` | Adapter-added transport receipt time; used for latency, replay-window and operational analysis, never as the event occurrence time |
| `source` | Stable authenticated source-system/component identity, not a display label; consumers authorize it against the integration configuration |
| `correlationId` | Stable workflow/transaction trace identifier shared across related commands, events and retries |
| `causationId` | Identifier of the immediate message or command that caused this message; consumers preserve the causal chain when emitting follow-on events |
| `scope` | Authorized Estate/Phase/Building/Unit or other property scope plus tenant context; consumers enforce scope before applying or projecting data |
| `payload` | Version-validated business data; consumers reject/quarantine malformed, incomplete or semantically invalid payloads without silently coercing ownership decisions |

Commands express intent; queries expose published views; events state facts. Consumers are idempotent, preserve `messageId` and correlation/causation links in audit context, and handle duplicates, retries and out-of-order messages according to the approved contract. Breaking changes require review, versioning and migration planning. Inbound requests require authentication, webhook verification where applicable, replay protection and auditable dead-letter exceptions. Exact third-party payloads remain unresolved; the 2IoThub contract is specified by PEMO.