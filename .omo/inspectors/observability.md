---
title: "Observability Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["observability-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Observability Inspector

> **Purpose:** Audits the project's observability posture: logging, metrics, tracing, error tracking, and alerting.

---

## What It Checks

1. **Logging** — Are there structured logs at key decision points? Are errors logged with context?
2. **Error tracking** — Is there a centralized error tracking system (Sentry, LogRocket, etc.)?
3. **API monitoring** — Are API latencies and error rates tracked?
4. **Client-side errors** — Are frontend errors captured and reported?
5. **Health endpoints** — Is there a `/health` or `/api/health` endpoint?
6. **Alerting** — Are there alerts for key failure modes?
7. **Request tracing** — Can a single request be traced across services?
8. **Database monitoring** — Are slow queries logged and tracked?
9. **Performance metrics** — Are Core Web Vitals or equivalent measured?
10. **Audit logging** — Are security-relevant events logged (logins, data changes, admin actions)?
11. **Error page** — Is there an error.tsx or equivalent fallback page?
12. **Telemetry** — Is there any telemetry export or observability platform configured?

---

## What It Ignores

1. Third-party service configuration for observability tools (e.g., Datadog agent setup).
2. Infrastructure-level monitoring (covered by DevOps).

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **HIGH** | No error tracking in production | Fix this cycle |
| **HIGH** | No health endpoint for load balancer | Fix this cycle |
| **MEDIUM** | Errors logged without context (no stack trace, no request ID) | Fix next cycle |
| **MEDIUM** | No audit logging for security events | Fix next cycle |
| **LOW** | No performance metrics collection | Backlog |
| **LOW** | Inconsistent log levels | Backlog |

---

## Failure Conditions

**FAIL** if:
- No error tracking solution configured
- No health check endpoint
- Errors are silently caught and ignored

**WARNING** if:
- Error logging lacks context (stack trace, request ID, user ID)
- No audit logging for auth or data changes
- No performance monitoring

**PASS** if:
- Error tracking is configured
- Health endpoint exists
- Errors are logged with sufficient context
- Security-relevant events are audited

---

## Key Questions

- If the application crashes, how do we know?
- If a user reports a bug, can we find the relevant logs?
- If a database query is slow, can we identify it?
- If an API endpoint returns 500, do we have the stack trace?
- If someone deletes data, can we trace who and when?

---

## Relations

- `agents/security.md` — logging is a security concern (audit trails)
- `agents/release-manager.md` — observability readiness is a release criterion
- `workflow/gates.md` — informs Gate 5 (Release Readiness)

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
