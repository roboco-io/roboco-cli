# Changelog

## v0.4.0-beta.1 (2026-04-04)

### Added
- CLAUDE.md generation delegates to `claude /init` with `<roboco>` context append
- Anti-Reinvention Rule in CLAUDE.md and CONTRIBUTING.md
- PRD "How" column — implementation methodology for each feature
- LICENSE, CONTRIBUTING.md, CHANGELOG.md

### Changed
- Removed custom CLAUDE.md template generator (anti-reinvention)
- Removed unused `select()` and `input()` from prompt utils
- Fixed all lint warnings

## v0.3.0-alpha.1 (2026-04-04)

### Added
- `roboco audit` command — vibe coding maturity scoring (5 categories, 100 points)
- GitHub Actions: release.yml (tag → npm publish → GitHub Release)
- GitHub Actions: auto-label.yml (keyword-based issue labeling)
- GitHub Actions: stale.yml (inactive issue/PR management)

## v0.2.0-alpha.1 (2026-04-04)

### Added
- `roboco add` command — add individual tools post-init
- `roboco sync` command — detect configuration drift
- `roboco validate` command — E2E setup validation
- Claude Agent SDK integration in interviewer.ts
- Pre-commit hook generation (stack-specific via husky)

## v0.1.0-alpha.1 (2026-04-04)

### Added
- Initial release with 6 commands: init, install, update, status, doctor, config
- Repository analyzer (7 languages, 9 frameworks)
- AI interview (auto + interactive modes)
- Configuration generator (CLAUDE.md, .claude/, hooks, CI/CD, process docs)
- Tool installer (OMC, MCP servers, OpenSpec, Harness)
- 52 tests (unit + integration + E2E)
- GitHub Actions CI (6-job pipeline)
- Git hooks (husky: pre-commit, pre-push)
- npm distribution (`npx roboco init`)
