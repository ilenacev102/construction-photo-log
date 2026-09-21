---
title: "Dependency Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["dependency-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Dependency Inspector

> **Purpose:** Audits project dependencies for known vulnerabilities, outdated packages, license issues, and unnecessary dependencies.

---

## What It Checks

1. **Vulnerability scan** — Known CVEs in direct and transitive dependencies.
2. **Outdated packages** — Packages behind latest major/minor/patch versions.
3. **Deprecated packages** — Packages that are unmaintained or deprecated.
4. **License compliance** — Licenses that may conflict with project requirements.
5. **Unused dependencies** — Packages in `package.json` / `requirements.txt` that are never imported.
6. **Dev vs. prod separation** — Packages in dependencies that should be devDependencies.
7. **Peer dependency mismatches** — Incompatible peer dependency versions.
8. **Duplicate dependencies** — Same package at different versions in the dependency tree.

---

## What It Ignores

1. Packages explicitly pinned for compatibility reasons (must be documented).
2. Internal/monorepo packages.
3. Lockfile-only changes that don't affect the dependency graph.

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **CRITICAL** | CVE with known exploit, CVSS >= 9.0 | Block release, fix immediately |
| **HIGH** | CVE with CVSS 7.0–8.9 or deprecated core dependency | Fix this cycle |
| **MEDIUM** | CVE CVSS 4.0–6.9 or outdated minor version | Fix next cycle |
| **LOW** | CVE CVSS < 4.0 or outdated patch version | Backlog |

---

## Failure Conditions

**FAIL** if:
- Any CRITICAL dependency vulnerability
- More than 3 HIGH vulnerabilities
- Any dependency with GPL license if project requires MIT/Apache

**WARNING** if:
- 1-3 HIGH vulnerabilities
- Unused dependencies found
- Dev/prod separation issues

**PASS** if:
- Zero CRITICAL vulnerabilities
- Zero HIGH vulnerabilities
- Clean dev/prod separation

---

## Output

```yaml
findings:
  - severity: "high"
    package: "eslint"
    version: "8.56.0"
    latest: "9.0.0"
    vulnerability: "CVE-2024-12345 (minimatch ReDoS)"
    recommendation: "Update eslint to 8.57.0 or migrate to 9.x"
  - severity: "medium"
    package: "@types/leaflet"
    type: "wrong-scope"
    detail: "Should be devDependency, not dependency"
    recommendation: "Move to devDependencies"
summary:
  critical: 0
  high: 1
  medium: 3
  outdated: 5
  unused: 2
  verdict: "WARNING"
```

---

## Relations

- `workflow/gates.md` — validates Gate 2
- `agents/security.md` — feeds vulnerability findings to Security

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
