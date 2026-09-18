---
title: "API Contract Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["api-contract-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# API Contract Inspector

> **Purpose:** Verifies that frontend and backend agree on API contracts. Detects mismatches in request/response types, endpoints, and data shapes.

---

## What It Checks

1. **Endpoint existence** — Every API route called from frontend exists in backend.
2. **HTTP methods** — Frontend uses correct method (GET/POST/PUT/DELETE) for each endpoint.
3. **Request shape** — Frontend sends the fields backend expects.
4. **Response shape** — Frontend expects the fields backend returns.
5. **Type consistency** — Types used in frontend match types used in backend for the same entity.
6. **Error response shape** — Frontend error handling matches backend error format.
7. **Status codes** — Backend returns expected status codes.
8. **Authentication requirements** — Frontend sends auth for endpoints that require it.
9. **Pagination consistency** — Both sides agree on pagination parameters and response format.

---

## What It Ignores

1. Internal API endpoints (not consumed by frontend).
2. Server-to-server API calls.
3. Webhook endpoints.

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **HIGH** | Frontend calls non-existent endpoint | Fix immediately |
| **HIGH** | Frontend expects fields backend doesn't return | Fix this cycle |
| **MEDIUM** | Type mismatch in optional fields | Fix next cycle |
| **MEDIUM** | Inconsistent error response shape | Fix next cycle |
| **LOW** | Inconsistent pagination parameter naming | Standardize |

---

## Failure Conditions

**FAIL** if:
- Frontend calls endpoint that doesn't exist
- Frontend expects required field that backend doesn't return
- Auth mismatch (frontend assumes public, backend requires auth)

**WARNING** if:
- Optional field mismatches
- Error shape inconsistencies
- Pagination parameter differences

**PASS** if:
- All endpoints match
- Request/response types are consistent
- Error handling is consistent

---

## Approach

The inspector works by:

1. Scanning frontend API client files for endpoint calls (fetch, axios, apiGet, apiPost)
2. Scanning backend route files for defined endpoints
3. Comparing the two sets
4. Comparing request/response type annotations where available

---

## Relations

- `agents/architect.md` — API contract is an architecture concern
- `formats/issue.md` — contract mismatches become issues

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
