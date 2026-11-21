# 2IoThub Boundary

- **Locked:** 2IoThub owns device registry, raw telemetry, gateways, OT/IT protocols, alarm detection, acknowledgement, lifecycle and technical escalation.
- **Locked:** PEMO owns resident-readable safety presentation, audience resolution, notification, response, management communication and resident-facing all-clear publication.
- **Proposed:** Integration Hub accepts authenticated, versioned events and translates them internally.
- **Locked:** `2IoThub` is the company's own product — a Go API gateway supporting IT and OT protocols, designed to sit between two modules or channels. It adapts to the contract its consumer defines rather than imposing a proprietary schema, so PEMO specifies the inbound contract it requires. Schemas, severity vocabulary, authentication, replay behaviour and event lifecycle are PEMO's to specify, not to discover.
- **Unresolved:** all-clear authority — a responsibility question, not a schema question — and which side maps a device or panel zone to a PEMO property location and classifies a raw signal into resident-readable severity. A gateway can carry any field asked of it; it cannot create information that does not exist upstream.

Candidate event names such as `safety_event_raised`, `safety_event_updated`, `safety_event_cleared`, `device_health_changed` and `integration_heartbeat` are names only until PEMO's contract approves them; they are not yet approved payloads.

PEMO must not acknowledge, suppress, clear or reclassify an alarm, disable a device, alter 2IoThub escalation or send equipment commands. An event or notification is not proof of technical alarm-state change.