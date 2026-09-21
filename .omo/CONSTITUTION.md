---
title: "Company Constitution"
type: specification
status: active
version: "1.0.0"
applies_to: ["all-agents"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Company Constitution

> **Purpose:** Defines the engineering principles, coding standards, review rules, security rules, merge rules, and documentation rules that govern all agents operating in this repository.

---

## 1. Engineering Principles

### 1.1 Quality Over Velocity
- No agent shall sacrifice correctness, security, or maintainability for speed.
- If a trade-off must be made, document it in the issue and escalate to CEO.

### 1.2 Single Responsibility
- Each agent has exactly one area of responsibility.
- No agent shall perform a task that belongs to another agent role.
- Reviewers do NOT write code. Repair agents do NOT review their own code.

### 1.3 Atomic Changes
- Every change addresses exactly one issue.
- A diff shall contain only changes required by that issue.
- "While I'm here" changes are forbidden unless explicitly specified in the issue.

### 1.4 Evidence Before Assertion
- Every claim must be backed by evidence: diagnostic output, test results, or cited code.
- "I think it works" is not sufficient. "Tests pass at exit code 0" is sufficient.

### 1.5 Parse, Don't Validate
- Validate input at system boundaries. Once validated, parse into typed structures.
- Prefer branded types, value objects, or discriminated unions over primitive types.

### 1.6 Fail Fast, Fail Loud
- Detect errors as early as possible.
- Log sufficient context to diagnose without reproduction.
- Never swallow errors with empty catch blocks.

### 1.7 Composition Over Inheritance
- Favor small, composable functions and interfaces over deep class hierarchies.
- Dependency injection over service location.

---

## 2. Coding Standards

### 2.1 Type Safety
- **No `as any`** — ever. If TypeScript cannot infer a type, restructure the code.
- **No `@ts-ignore` or `@ts-expect-error`** — these suppress real errors.
- **No `any`** — use `unknown` and narrow with type guards.
- All function signatures must have explicit return types.
- All public API surfaces must have documented parameter types.

### 2.2 Error Handling
- Every error must be caught, logged, and either handled or re-thrown with context.
- No empty `catch {}` blocks.
- Use typed error classes, not string errors.
- Distinguish between operational errors (expected) and programmer errors (bugs).

### 2.3 Naming Conventions
- **Files:** `kebab-case.ts` — lowercase with hyphens
- **Functions/Variables:** `camelCase`
- **Classes/Interfaces/Types:** `PascalCase`
- **Constants:** `UPPER_SNAKE_CASE`
- **React Components:** `PascalCase.tsx`
- **API Routes:** `kebab-case/route.ts`

### 2.4 File Size Limits
- **Source files:** maximum 250 lines of logic (excluding imports, types, blank lines)
- **React components:** maximum 200 lines
- **Test files:** maximum 300 lines
- Files exceeding these limits MUST be refactored into smaller modules.

### 2.5 Imports
- Group imports: (1) external, (2) internal absolute, (3) relative, (4) types
- No unused imports.
- Prefer explicit imports over namespace imports (`import { X }` over `import *`).

### 2.6 Comments
- Comments explain WHY, not WHAT. The code shows WHAT.
- Every public API must have a JSDoc/TSDoc comment.
- TODO comments must reference an issue ID.

---

## 3. Review Rules

### 3.1 Independence
- A reviewer must be a different agent than the repair agent.
- No agent may approve its own changes.

### 3.2 Scope
- Reviews are limited to 400 lines of diff per session.
- If a diff exceeds 400 lines, it must be split into multiple issues.

### 3.3 Review Criteria
Every review must check:
1. **Correctness** — Does the code do what the issue specifies?
2. **Security** — Does the change introduce any vulnerability?
3. **Type Safety** — Are types correct? No `any`, no `@ts-ignore`?
4. **Error Handling** — Are errors caught and handled?
5. **Edge Cases** — What happens with null, empty, invalid input?
6. **Test Coverage** — Are there tests for the change?
7. **Style Compliance** — Does it match this Constitution?
8. **Diff Discipline** — Does the diff contain unrelated changes?

### 3.4 Review Output
- Every finding must be classified: `blocking` | `major` | `minor` | `nit`
- Blocking findings must be resolved before merge.
- Review must end with PASS or FAIL.

### 3.5 Response
- The repair agent must respond to every finding.
- Responses are: `fixed` (with reference) | `acknowledged` (will fix later) | `disputed` (with reasoning).

---

## 4. Security Rules

### 4.1 Zero Trust
- No agent shall assume that any input, request, or data is safe.
- Validate at every boundary: API → service → database.

### 4.2 Secrets
- No secrets in code. Never. No exceptions.
- Secrets include: API keys, tokens, passwords, connection strings, private keys.
- `.env.local` must never be committed.
- If a leak is detected, the issue is CRITICAL severity.

### 4.3 Injection Prevention
- Use parameterized queries for all database operations.
- Use `execSync` or `exec` only with validated, non-user input.
- Sanitize all output rendered to HTML.
- Escape all user input in shell commands.

### 4.4 Authentication & Authorization
- Every API endpoint must verify authentication unless explicitly public.
- Every data access must verify authorization (ownership, role, company scope).
- Row-Level Security (RLS) must be enforced on all database tables.
- Service-role clients must be restricted to server-only operations that require escalation.

### 4.5 Input Validation
- Validate all input at API boundaries.
- Validate file types, sizes, and content before processing.
- Never trust file extensions alone — validate content signatures.

### 4.6 Security Review
- Security reviews are READ-ONLY. Security agent never modifies code.
- Security findings are classified: CRITICAL | HIGH | MEDIUM | LOW.
- CRITICAL and HIGH findings block all other work until resolved.

---

## 5. Merge Rules

### 5.1 Prerequisites
Before any merge, ALL of the following must be true:
- [ ] Build passes (`npm run build` or equivalent)
- [ ] TypeScript compiles (no errors)
- [ ] Lint passes (no errors)
- [ ] All existing tests pass
- [ ] New tests pass (if tests were added)
- [ ] Code review PASS
- [ ] Security review PASS (if change touches security-sensitive code)
- [ ] Quality Gate 3 passes (if regression suite exists)

### 5.2 Merge Authority
- Only the CEO agent may approve a merge.
- The CEO considers: review outcome, security outcome, regression outcome.

### 5.3 Merge Strategy
- Use squash-merge for feature branches.
- Commit message must reference the issue ID.
- Commit message format: `{type}({scope}): {description} (#{issue-id})`

### 5.4 Rollback Plan
- Every merge must include a rollback strategy documented in the issue.
- Rollback strategies: revert commit, feature flag disable, database migration revert.

---

## 6. Documentation Rules

### 6.1 Every Change Must Be Documented
- At minimum: what changed and why.
- If the change affects the API, update the relevant documentation.

### 6.2 Issue Documentation
- Every completed issue must have its RCA filed (see `formats/rca.md`).

### 6.3 Architecture Decisions
- Significant architecture decisions must be recorded.
- Format: problem, decision, alternatives considered, consequences.

### 6.4 No Proactive READMEs
- Do not create or modify README files unless explicitly requested.

---

## 7. Quality Gates Reference

This Constitution works in conjunction with `workflow/gates.md`. All agents must know the current gate and its PASS/FAIL criteria.

---

## 8. Violations

### 8.1 Process Violations
Any agent found violating this Constitution shall:
1. Be flagged by the Engineering Director.
2. Have the violation recorded in the Engineering Health Report.
3. Be blocked from further work until the violation is acknowledged.

### 8.2 Code Violations
Code that violates this Constitution:
1. Review must block it.
2. Security must flag it.
3. RCA must analyze how the process failed to prevent it.

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
