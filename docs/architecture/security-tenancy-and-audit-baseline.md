# Security, Tenancy and Audit Baseline

- **Locked:** server-side isolation for Estate, Phase and property scope; least-privilege and read-only integration defaults.
- **Proposed:** centralized authorization policy and append-only material-operation audit.
- **Unresolved:** identity provider, retention/legal regime, Hong Kong privacy/compliance review, storage and malware-scanning vendors.

## Bounded controls

| Control | Status | Minimum boundary |
|---|---|---|
| Audit append-only and tamper evidence | Proposed | Material access, publication, state and integration decisions append an actor/source/time/scope/correlation record; consumers cannot update/delete it; tamper evidence and verification failures raise an auditable alert |
| Retention and legal hold | Unresolved | Retention classes, deletion, export and legal-hold precedence require an approved policy; legal hold prevents destructive disposal while active; no retention period or compliance claim is selected here |
| Webhook verification and key rotation | Proposed | Verify authenticated source, signature or equivalent before parsing/applying; maintain active/previous key overlap only under explicit rotation policy; unverifiable messages are rejected/quarantined |
| Replay protection | Proposed | Record source message ID, correlation and receipt time within a contract-defined replay window; duplicates are idempotently suppressed and stale/replayed messages are quarantined |
| Attachment quarantine and scan failure | Proposed | New attachments remain unavailable until type/size validation and malware scanning pass; scan failure or timeout keeps the item quarantined and creates an auditable exception; no fail-open download |
| Download authorization | Proposed | Recheck authenticated actor, resident relationship, property scope, document audience and attachment state at download time; use short-lived authorized access only after policy approval |
| Privileged-access review | Proposed | Privileged actions require least privilege, reason/context and audit evidence; periodic review of privileged roles and access is required; emergency access must be time-bounded and reviewed |

Authorize every user/service operation against role and scope. Keep Resident identity separate from login credentials. Do not expose internal Case notes or other residents. Keep secrets and private keys in approved runtime storage, never in repository or reports. These controls do not select vendors or claim Hong Kong compliance.