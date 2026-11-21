# Module Catalogue and Ownership

## Canonical module list

| Module | Owns | Prohibited ownership |
|---|---|---|
| Platform Foundation | configuration, errors, logging, health, flags, migrations, envelope and idempotency primitives | business workflow |
| Identity and Access | accounts, authentication, roles, permissions, sessions and access scope | Resident profile or occupancy truth |
| Property Core | Estate, Phase, Building/Block, Floor, Unit, common areas and facility locations | resident identity or physical work |
| Resident and Household | Resident, Household, membership, occupancy, caregiver and communication preferences | login credentials or property master |
| Help Desk | Ticket, resident conversation, attachments, category, priority, queues, assignment, unread state, SLA and Ticket-to-Case linkage | Case investigation or maintenance execution |
| Service Case | investigation, ownership, actions, related Tickets, external references, resident-visible updates and resolution verification | technician dispatch, asset lifecycle or work-order execution |
| Notices and Communication | message content, audience, approval, publication, scheduling and acknowledgement records | provider delivery state or raw telemetry |
| Forms and Submissions | form definitions, versions, submissions, review and decisions | generic low-code platform or notification delivery |
| Documents | resident-facing documents, versions and audiences | enterprise contract management or physical assets |
| Amenities and Booking | directory, availability, rules, reservations and cancellation | physical asset maintenance |
| Community Engagement | community events and activities with registration, capacity and attendance; resident surveys and polls; estate calendar, service directory and community information | booking, payment, notice publication or any statutory owners' process |
| Resident Services | bounded Visitor, Access, Car Park, EV Charging and future Native/Integrated/Linked services | unapproved device control or physical work |
| Home Safety | resident-readable safety presentation, audience resolution, response state, management communication and all-clear publication | devices, telemetry or alarm lifecycle |
| Notification | delivery requests, templates, provider state, retry and provider adapters | message content ownership or resident business decisions |
| Integration Hub | connections, mappings, translation, inbound/outbound transport, idempotency, retry, sync state and exceptions | Ticket, Case, safety or resident-audience decisions |
| Audit and Compliance | audit evidence, access history, publication records, status-change records and retention support | SIEM or operational workflow |
| Reporting and Attention Centre | approved operational projections and attention views | arbitrary cross-schema querying or source-data ownership |

### Community Engagement — binding constraint on surveys and polls

**Locked:** a survey or poll result is never a resolution, a mandate or a binding decision, and the module must not be used to conduct any statutory owners' process. In Hong Kong, owners' corporation resolutions are regulated under the Building Management Ordinance, and a polling feature inside a property-management application sits one misunderstanding away from being treated as an owners' vote. Results are presented as informal feedback only. Community Engagement is Phase 2 and owns no booking, payment or notice-publication datum — those remain with Amenities and Booking, the approved payment service and Notices and Communication.

**Locked:** one business datum has one owner; modules do not write directly to another module's tables; cross-module database foreign keys are avoided. **Proposed:** each module exposes application ports and keeps persistence behind its boundary. **Unresolved:** exact framework and schema-enforcement mechanism.

## Datum, command and event ownership matrix

| Datum / interaction | Owner or authority | Typical command/event responsibility |
|---|---|---|
| Message content, audience intent and publication record | Notices and Communication | `PublishMessage` command; `message_published` event |
| Ticket conversation and resident-visible thread | Help Desk | `CreateTicket`, `AppendTicketMessage`; `ticket_message_added` event |
| Form definition/version and submission/decision | Forms and Submissions | `SubmitForm`, `RecordFormDecision`; `form_submitted` event |
| Resident-facing document/version/audience | Documents | `PublishDocument`; `document_published` event |
| Resident Service reference and service request state | Resident Services | bounded service command/event; exact service contracts unresolved |
| Delivery request, provider delivery state and retry | Notification | `RequestDelivery`; `delivery_state_changed` event |
| Resident safety response state and all-clear publication | Home Safety | `RecordSafetyResponse`, `PublishAllClear`; `safety_response_recorded` / `all_clear_published` events |
| 2IoThub/device event transport and mapping state | Integration Hub; source device authority remains 2IoThub | `IngestExternalEvent`; internal translated event; payload specified by PEMO's contract with 2IoThub |
| Case investigation and resolution verification | Service Case | `CreateCase`, `VerifyResolution`; `case_state_changed` event |
| Physical external work status/reference | External Work system; PEMO Integration Hub stores translation/reference | `RequestExternalWork`, `IngestWorkUpdate`; exact contract unresolved |
| Business audit evidence | Audit and Compliance | `AppendAuditEvidence`; `audit_evidence_appended` event |
| Operational projection/read model | Reporting and Attention Centre | projection consumer; source datum remains with owning module |

Commands are authorized by the owning module and events are emitted by the module that owns the fact. Consumers may create projections or local references but may not become owners of the source datum. Exact third-party payloads remain unresolved; the 2IoThub contract is specified by PEMO.