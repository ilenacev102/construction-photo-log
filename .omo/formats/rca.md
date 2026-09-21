---
title: "Root Cause Analysis Format Specification"
type: specification
status: active
version: "1.0.0"
applies_to: ["rca"]
last_reviewed: "2026-07-30"
supersedes: []
---

# Root Cause Analysis Format

> **Purpose:** Defines the standard format for every Root Cause Analysis. Every issue that reaches the RCA phase MUST produce an RCA document in this format.

---

## Structure

```yaml
---
id: "RCA-PREFIX-NNN"
issue_id: "PREFIX-NNN"
title: "RCA: Short description of the issue"
date: "2026-07-30"
author: "rca-agent"
status: "completed"            # completed | pending-review | approved
---
```

## Sections

### 1. Summary

One paragraph describing the issue and its impact.

```
Summary:
The SERVICE_ROLE_KEY was committed to .env.local, exposing full database
admin access to anyone with repository access. This bypasses all Row-Level
Security policies and allows unauthorized data access.
```

### 2. Root Cause Analysis

Three questions, each answered:

#### 2.1 Why did the problem occur?

The technical root cause. What code, configuration, or design decision caused this?

```
Root Cause:
.env.local was included in the repository for local development convenience.
The service role key was copied from Supabase dashboard and never removed
before commit. No .gitignore rule excluded .env.local (or the rule was
misconfigured).
```

#### 2.2 Why was it not detected earlier?

What processes, tools, or checks should have caught this before it reached production?

```
Detection Gap:
1. No git pre-commit hook scans for secrets.
2. No CI pipeline secret scanning step.
3. No code review checklist item for secrets in config files.
4. .env.local was not in .gitignore, so git tracked it by default.
```

#### 2.3 What process change prevents recurrence?

What must change in the engineering system to prevent this class of error?

```
Preventive Actions:
1. Add .env.local to .gitignore (immediate).
2. Install and configure a pre-commit secret scanner (e.g., trufflehog, git-secrets).
3. Add secret scanning to CI pipeline as a blocking check.
4. Update code review checklist: "Check for secrets in config files."
5. Add Secrets Inspector to the mandatory inspector list for every release.
```

### 3. Corrective Actions

| Action | Owner | Deadline | Status |
|--------|-------|----------|--------|
| Add .env.local to .gitignore | Repair Agent | Immediate | Done |
| Install pre-commit secret scanner | DevOps | This sprint | Pending |
| Add CI secret scanning | DevOps | This sprint | Pending |
| Update review checklist | Engineering Director | This sprint | Pending |

### 4. Lessons Learned

What broader lessons does this incident teach?

```
Lessons:
- Secret leaks are a process failure, not a developer failure.
- Every project should have secret scanning from day one.
- .env files should be in .gitignore from repository initialization.
- Service role keys should never leave the Supabase dashboard — use
  anon key with RLS for client-side operations.
```

### 5. Blast Radius Assessment

What was the actual exposure?

```
Exposure:
- Repository is private, but any collaborator with read access had the key.
- Key was never used in a production breach (no evidence of compromise).
- Key has been rotated (invalidated) as part of the fix.
- All audit logs reviewed: no unauthorized access detected.
```

### 6. Verification

How do we know the fix works and the process change is effective?

```
Verification:
- git grep SERVICE_ROLE_KEY returns no results in committed files.
- Pre-commit hook blocks any commit containing a Supabase service key pattern.
- CI pipeline fails on secret patterns.
- Random spot checks of recent commits show no secrets.
```

---

## Relations

- `formats/issue.md` — the issue being analyzed
- `templates/rca-template.md` — usable RCA template
- `agents/rca.md` — agent responsible for RCA

---

## Version History

| Version | Date | Changes |
|---------|------|---------|
| 1.0.0 | 2026-07-30 | Initial creation |
