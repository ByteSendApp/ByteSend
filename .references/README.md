# ByteSend Internal References

This folder contains technical reference docs for maintainers and contributors.

## Documents

- webhook-architecture.md
  - Event emission, queue processing, retries, signatures, and payload contracts
- smtp-auth-and-operations.md
  - SMTP relay auth flow, custom username behavior, TLS modes, port strategy, and troubleshooting
- inbound-email.md
  - Receiving pipeline, AWS setup (S3, SNS, receipt rule, hosted domain), limits and troubleshooting
- release-playbook.md
  - Practical release checklist from changelog prep to tags and GitHub release publication
- repository-governance.md
  - Contributor workflow, issue/PR templates, and community health files

## Usage Guidance

- Keep references implementation-aware and code-grounded.
- Update docs in this folder when changing architecture or operations.
- Prefer adding "last reviewed" dates for high-churn systems.
