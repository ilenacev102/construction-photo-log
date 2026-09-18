## What / Why

<!-- One paragraph: what changed and why it matters. -->

## Verification

- [ ] `npm run type-check` green
- [ ] `npm run lint` green
- [ ] `npm run test` green (384 tests)
- [ ] New behavior covered by tests (or: docs-only, no code change)

## Security checklist (for auth / RLS / upload / API changes)

- [ ] No secrets, tokens or internal URLs added
- [ ] Server-side access check preserved (`requireAuth` + project scope)
- [ ] 5xx responses stay generic; user input validated

Related issue: #
