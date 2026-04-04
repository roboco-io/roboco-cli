# ROBOCO CLI — Quality Gates

> Based on [oh-my-claudecode](https://github.com/Yeachan-Heo/oh-my-claudecode) quality gate patterns

## Tier 1 — MVP (setup before development)

| Gate | Tool | Enforcement |
|------|------|-------------|
| Lint | ESLint (flat config) | CI required |
| TypeCheck | `tsc --noEmit` (strict) | CI required |
| Unit Tests | Vitest | CI required |
| Build | tsup | CI required |
| npm Pack Test | `npx roboco --version/--help` | CI required |
| Version Consistency | package.json + git tag | CI required |
| Conventional Commits | `<type>(<scope>): <subject>` | Convention (enforced v0.2) |

## Tier 2 — MVP mid-phase (from first PR)

| Gate | Tool | Enforcement |
|------|------|-------------|
| PR Size Labeling | GitHub Actions (S/M/L/XL) | Auto-label, XL warning |
| Branch Protection | dev (PR target) / main (release only) | GitHub settings |
| Bundle Size | dist/ < 10MB threshold | CI warning |
| Test Coverage | V8 via Vitest | 70%+ for core/ modules |

## Tier 3 — v0.2+

| Gate | Tool | Enforcement |
|------|------|-------------|
| Auto Release | release.yml → npm publish → GitHub Release | Tag trigger |
| Stale Issue Mgmt | 30d inactive → stale, +14d → close | Scheduled |
| Issue Auto-label | Keyword-based labeling | On issue create |
| Commit Metadata | Constraint, Confidence, Scope-risk trailers | Convention |

## CI Pipeline (ci.yml)

```
PR push / merge
  ↓ (parallel)
  ├─ Lint + TypeCheck
  ├─ Test (vitest run)
  ├─ Build (tsup) + size check
  ├─ Version consistency
  └─ npm pack + smoke test
  ↓
  All pass? → Ready for review
```

## Not Adopted

| Gate | Reason |
|------|--------|
| Local pre-commit hooks | OMC also skips this; CI enforcement is more reliable |
| Artifact cleanup | Not needed at project inception |
