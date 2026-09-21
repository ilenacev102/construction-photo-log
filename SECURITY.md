# Security Policy

## Supported Versions

| Version | Supported |
| ------- | --------- |
| `main` (latest) | ✅ |
| Older commits | ❌ (upgrade to latest `main`) |

## Reporting a Vulnerability

**Do not open a public issue for security reports.**

- Open a [GitHub Security Advisory](https://github.com/ilenacev102/construction-photo-log/security/advisories/new)
  (private by default), or
- Contact the maintainers directly with:
  - affected route / file and version (commit SHA),
  - steps to reproduce or proof of concept,
  - impact assessment (who is affected, what data is exposed).

We acknowledge reports within 72 hours and aim to ship a fix within
14 days for High/Critical issues. You will be credited in the fix commit
unless you request anonymity.

## Scope Notes for Researchers

High-value areas: tenant isolation (RLS bypass), auth/session handling,
IDOR across projects, stored XSS in comments/notes, manifest tampering
(Evidence OS), rate-limit bypass, service-role misuse.

Out of scope: the hosted demo deployment's infrastructure (report to the
host instead), social engineering, physical attacks, and findings that
require a compromised maintainer machine.

## Guarantees We Hold Ourselves To

- RLS deny-by-default; every privileged write re-checked server-side.
- 5xx responses never leak internals; user input is validated (Zod) and
  HTML in user content is never rendered raw.
- `npm audit --audit-level=critical` gates every merge to `main`.
