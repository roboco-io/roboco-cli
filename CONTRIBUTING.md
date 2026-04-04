# Contributing to ROBOCO CLI

## Development Setup

```bash
git clone https://github.com/roboco-io/roboco-cli.git
cd roboco-cli
npm install
npm run build
```

## Scripts

| Script | Purpose |
|--------|---------|
| `npm run build` | Build with tsup |
| `npm run dev` | Watch mode |
| `npm run test` | Unit + integration tests |
| `npm run test:e2e` | End-to-end tests (requires build) |
| `npm run test:all` | All tests |
| `npm run lint` | ESLint |
| `npm run format` | Prettier |
| `npm run typecheck` | TypeScript strict check |
| `npm run validate` | Full pipeline: typecheck → lint → test → build |

## Git Hooks

- **pre-commit**: lint-staged (ESLint + Prettier on staged files)
- **pre-push**: typecheck + unit/integration tests

## Commit Convention

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>(<scope>): <subject>
```

Types: `feat`, `fix`, `docs`, `style`, `refactor`, `test`, `chore`, `ci`

## Anti-Reinvention Rule

Before implementing any feature, check if it already exists in:
1. Claude Code built-in (`/init`, `/compact`, tools)
2. Claude Code SDK / Agent SDK
3. OMC (agents, skills, workflows)
4. npm ecosystem

If existing functionality covers 80%+ of the need, **wrap/delegate** instead of reimplementing.

## Pull Requests

1. Branch from `main`
2. Run `npm run validate` before submitting
3. All CI checks must pass
4. Keep PRs focused — one feature or fix per PR
