---
name: contributing-guide
description: ROBOCO CLI contributing rules — commit conventions, anti-reinvention, PR workflow, validation pipeline. Auto-loads when writing code, creating commits, or opening PRs.
user-invocable: false
paths: "src/**,tests/**,*.ts,*.json"
---

# Contributing Rules

These rules apply to all code changes in this project. Loaded from [CONTRIBUTING.md](../../../CONTRIBUTING.md).

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

## Before Every Commit

1. `npm run validate` must pass (typecheck → lint → test → build)
2. Pre-commit hook runs lint-staged (ESLint --fix + Prettier)
3. Pre-push hook runs typecheck + tests + AI code review

## Anti-Reinvention Rule

Before implementing ANY feature, check if it already exists in:
1. **Claude Code built-in** — `/init`, `/compact`, built-in tools
2. **Claude Code SDK / Agent SDK** — `query()`, hooks, permissions
3. **OMC** — agents, skills, workflows
4. **npm ecosystem** — established packages

If existing functionality covers 80%+ of the need, **wrap/delegate** instead of reimplementing.

Examples:
- CLAUDE.md → delegate to `claude /init`, append `<roboco>` tag
- AI conversation → Agent SDK `query()`, not raw API
- MCP install → `claude mcp add`, not manual config writing
- Git hooks → `husky`, not `.git/hooks` manipulation

## Pull Request Rules

1. Branch from `main`
2. Run `npm run validate` before submitting
3. All CI checks must pass (lint, typecheck, unit, integration, E2E, build)
4. Keep PRs focused — one feature or fix per PR
5. AI-authored PRs are welcome — this project is 100% vibe-coded

## Code Style

- ESM only: `import/export`, never `require`
- TypeScript strict mode, no `any`
- Named exports only, no default exports
- kebab-case file naming
- User-facing errors must be friendly with actionable next steps
