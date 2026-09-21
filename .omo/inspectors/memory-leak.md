---
title: "Memory Leak Inspector Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["memory-leak-inspector"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Memory Leak Inspector

> **Purpose:** Scans for common memory leak patterns: unrevoked object URLs, unremoved event listeners, uncleaned timers, unclosed subscriptions, and unmanaged WebSocket connections.

---

## What It Checks

1. **Object URLs** — `URL.createObjectURL()` called without corresponding `URL.revokeObjectURL()`.
2. **Event listeners** — `addEventListener` without corresponding `removeEventListener`.
3. **Timers** — `setInterval` / `setTimeout` without `clearInterval` / `clearTimeout`.
4. **Subscriptions** — RxJS, Redux, or custom subscriptions without unsubscribe.
5. **WebSocket connections** — WebSocket opened without close handler.
6. **DOM references** — Stale DOM references in closures.
7. **React useEffect cleanup** — Effects that add listeners/timers/subscriptions without cleanup return.
8. **Intersection/Mutation observers** — Observers without `disconnect()`.
9. **Canvas contexts** — Canvas allocations without cleanup.
10. **Large objects in closures** — Captured references preventing garbage collection.

---

## What It Ignores

1. Node.js server-side memory patterns (handled by different tools).
2. Native browser features that auto-cleanup on component unmount.
3. Short-lived components where leaks are trivial.

---

## Severity Classification

| Severity | Definition | Response |
|----------|------------|----------|
| **HIGH** | Object URL leak in image-heavy component | Fix this cycle |
| **HIGH** | Event listener leak on long-lived component | Fix this cycle |
| **MEDIUM** | Timer without cleanup on component that remounts | Fix next cycle |
| **MEDIUM** | Subscription without unsubscribe | Fix next cycle |
| **LOW** | Missing cleanup on component that mounts once | Fix when convenient |

---

## Failure Conditions

**FAIL** if:
- Object URL created without revoke in component lifecycle
- Event listener added without remove on component unmount
- Interval/timeout without clear on component unmount

**WARNING** if:
- Subscription without unsubscribe reference stored
- Observer without disconnect
- Missing cleanup on any effect that allocates resources

**PASS** if:
- All resource allocations have corresponding cleanup
- All effects return cleanup functions when needed

---

## Approach

The inspector searches for patterns:

1. `createObjectURL` → check for `revokeObjectURL` in same component
2. `addEventListener` → check for `removeEventListener` in cleanup
3. `setInterval` / `setTimeout` → check for `clearInterval` / `clearTimeout`
4. `.subscribe(` → check for `unsubscribe()`
5. `new WebSocket` → check for `.close()`
6. `new MutationObserver` / `new IntersectionObserver` → check for `.disconnect()`
7. React `useEffect` with setup → check for cleanup return function

---

## Relations

- `agents/reviewer.md` — findings feed into code review
- `CONSTITUTION.md` — Section 2 (Coding Standards)
- `inspectors/state-management.md` — complementary state analysis

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
