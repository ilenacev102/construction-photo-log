---
title: "Secrets Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["secrets-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Secrets Inspector

> **Purpose:** Scans the codebase for exposed secrets, API keys, tokens, credentials, and sensitive configuration. Runs as part of the mandatory inspector suite for every release.

---

## What It Checks

1. **Committed secrets** — API keys, tokens, passwords, connection strings in committed files.
2. **`.env` and config files** — `.env`, `.env.local`, `.env.*` files tracked by git.
3. **Source code secrets** — Hardcoded credentials, tokens, or keys in source files.
4. **Configuration files** — `*.json`, `*.yaml`, `*.toml`, `*.ini` with sensitive values.
5. **Docker files** — Credentials in Dockerfile, docker-compose.yml.
6. **CI/CD config** — Secrets in GitHub Actions, CircleCI, or other CI configs.
7. **Comments** — Secrets or credentials in comments or documentation.

---

## What It Ignores

1. `node_modules/`, `.next/`, `build/`, `dist/` — generated directories.
2. Known false-positive patterns (e.g., example keys in documentation).
3. Files explicitly listed in `.secretsignore` (must be reviewed by CEO).

---

## Severity Classification

| Severity | Definition | Example |
|----------|------------|---------|
| **CRITICAL** | Active, valid secret in committed file | `SERVICE_ROLE_KEY=eyJ...` in `.env.local` in git |
| **HIGH** | Potential secret or credential in committed file | Password-like string in source code |
| **MEDIUM** | Secret in ignored file but risky pattern | `.env` not in git but contains production credentials |
| **LOW** | Configuration that could lead to exposure | Permissive CORS origin, disabled SSL |

---

## Failure Conditions

**FAIL** if:
- Any CRITICAL finding is detected
- More than 3 HIGH findings

**WARNING** if:
- Any MEDIUM finding is detected
- 1-3 HIGH findings

**PASS** if:
- Zero CRITICAL findings
- Zero HIGH findings

---

## Output

Produces a structured report:

```yaml
findings:
  - severity: "critical"
    file: ".env.local"
    pattern: "SERVICE_ROLE_KEY"
    description: "Supabase service role key committed to repository"
    recommendation: "Remove from git, rotate key, add to .gitignore"
  - severity: "high"
    file: "src/config.ts"
    pattern: "password = '***'"
    description: "Hardcoded credential in source code"
    recommendation: "Move to environment variable"
summary:
  critical: 0
  high: 1
  medium: 3
  low: 5
  verdict: "WARNING"
```

---

## Relations

- `agents/security.md` — shares findings with Security agent
- `CONSTITUTION.md` — Section 4.2 (Secrets)
- `workflow/gates.md` — validates Gate 2

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
