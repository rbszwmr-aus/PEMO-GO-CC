# Phased Delivery Plan

- **Locked:** architecture precedes parallel module implementation.
- **Proposed:** walking skeleton before domain expansion.
- **Unresolved:** framework, broker/outbox, identity, storage, notification providers and first external-work target.

1. Architecture review.
2. Contract/security decisions and platform walking skeleton.
3. Property hierarchy: Estate, optional Phase, Building, Floor, Unit.
4. Resident/Household.
5. Help Desk Ticket conversation.
6. Ticket-to-Case.
7. Simulated 2IoThub Home Safety communication path.
8. External-work adapter after a separate contract decision.

The safety demo may simulate authenticated inbound events, location mapping, audience resolution, resident communication, response and all-clear. It must not operate devices, own telemetry, acknowledge alarms, dispatch emergency services or claim certified capability. Tests and simulator success are not production proof.