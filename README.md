# ROBOCO CLI

[![CI](https://github.com/roboco-io/roboco-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/roboco-io/roboco-cli/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/roboco-io/roboco-cli?include_prereleases)](https://github.com/roboco-io/roboco-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D24-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-purple)](https://claude.com/claude-code)

> Enterprise-grade scaffolding for full vibe coding — where developers never touch code directly

One command. Your entire repository becomes production-ready for full vibe coding.

```bash
npx roboco init
```

ROBOCO CLI enables **full vibe coding** at enterprise production level — a development paradigm where developers express intent and AI writes all the code. No manual coding. No code review by humans. Instead, AI agents handle implementation, testing, and validation end-to-end, governed by rigorous process, documentation, and automated quality gates that live in your repository.

This isn't a toy for side projects. ROBOCO sets up the harness, guardrails, and enforcement layer that make full vibe coding safe and reproducible for teams shipping to production.

## Why ROBOCO?

### The Problem

Full vibe coding demands more discipline than traditional development, not less. Without proper harness engineering:

- AI-generated code with no standardized quality gates ships unchecked to production
- Every developer configures `CLAUDE.md`, `.claude/`, MCP servers, and hooks differently
- New team members spend hours figuring out "how do we vibe code here?"
- There's no enforcement — one developer's AI workflow doesn't carry over to another
- Process, documentation, and agent orchestration patterns are tribal knowledge, not code
- Without harness engineering, full vibe coding is a liability, not a superpower

### The Solution

ROBOCO turns full vibe coding from a risky experiment into a **governed, reproducible engineering practice**.

| Without ROBOCO | With ROBOCO |
|----------------|-------------|
| AI writes code with no guardrails | Automated quality gates enforce standards on every AI-generated change |
| Manual CLAUDE.md writing | `claude /init` + project-specific `<roboco>` context, auto-generated |
| Copy-paste .claude/ settings | Stack-detected hooks (TS→Prettier, Py→Black, Go→gofmt) |
| "Ask Sarah how she set up MCP" | `roboco install` — one command, identical environment |
| No process, no docs | 5-stage vibe coding templates (Intent → Requirements → Research → Plan → Implement) |
| Works on my machine | CI/CD enforces vibe coding rules via pre-commit hooks + GitHub Actions |
| No visibility into setup quality | `roboco audit` scores your maturity across 5 categories (100 points) |
| Full vibe coding feels unsafe | Harness engineering makes it production-safe |

### Key Benefits

**For Individual Developers**
- **Zero-config start** — `npx roboco init --auto` analyzes your repo and sets up everything in seconds
- **Best-practice defaults** — OMC agents, MCP servers, Claude Code Hooks, all pre-configured for your stack
- **Structured process** — 5-stage templates prevent "just start coding" anti-patterns

**For Teams**
- **One setup, every developer** — `roboco install` reproduces the exact vibe coding environment from `.roboco/config.json`
- **Enforced consistency** — Pre-commit hooks and CI pipelines validate that rules are followed, even by non-vibe-coders
- **Drift detection** — `roboco sync --check` catches when config diverges from the repo state
- **Onboarding in minutes** — New member? `git clone && npx roboco install`. Done.

**For Tech Leads**
- **Maturity scoring** — `roboco audit` quantifies your vibe coding setup across Claude Code env, process docs, quality gates, tool integration, and team consistency
- **Actionable improvements** — Every audit finding comes with a specific suggestion
- **Standards as code** — Vibe coding rules live in the repo, not in a wiki nobody reads

## Architecture: Multi-Layer Verification Harness

ROBOCO CLI sets up a 7-layer verification harness that governs the entire AI development lifecycle:

<p align="center">
  <img src="docs/harness-architecture.svg?v=2" alt="ROBOCO Multi-Layer Verification Harness" width="800" />
</p>

| Layer | Gate | What it enforces |
|-------|------|-----------------|
| 1 | Developer Intent | 5-stage vibe coding process (Intent → Requirements → Research → Plan → Implement) |
| 2 | AI Code Generation | CLAUDE.md context, stack-specific hooks, OMC agents, Harness teams |
| 3a | Pre-commit | lint-staged → ESLint + Prettier auto-format |
| 3b | Pre-push | TypeCheck → Tests → AI Code Review (Claude Agent SDK) |
| 4 | CI Pipeline | Lint, TypeCheck, Unit, Integration, E2E, Build + Smoke test |
| 5 | Release Gate | Tag → Validate → npm publish → GitHub Release |
| 6 | Repo Hygiene | Issue auto-label, stale management, drift detection |
| 7 | Maturity Audit | 100-point scoring across 5 categories |
- **Maturity scoring** — `roboco audit` quantifies your vibe coding setup across Claude Code env, process docs, quality gates, tool integration, and team consistency
- **Actionable improvements** — Every audit finding comes with a specific suggestion
- **Standards as code** — Vibe coding rules live in the repo, not in a wiki nobody reads

## Features

- **AI-Powered Interview** — Analyzes your repo (stack, structure, existing config) then asks targeted questions via Claude Code SDK to customize the setup
- **Smart Stack Detection** — Automatically detects your tech stack (TypeScript, Python, Go, Rust, Java, etc.) and applies optimized settings
- **Claude Code Environment** — Delegates to `claude /init` for CLAUDE.md, generates `.claude/` settings, Claude Code Hooks, and MCP server configurations
- **Team Consistency** — Every developer who clones the repo gets the identical vibe coding environment via `roboco install`
- **CI/CD Enforcement** — Pre-commit hooks and GitHub Actions workflows enforce vibe coding rules even for non-vibe-coding members
- **5-Stage Process Templates** — Intent → Requirements → Research → Plan → Implement, with documents at each stage
- **Maturity Audit** — Score your vibe coding setup across 5 categories with actionable improvement suggestions
- **Drift Detection** — `roboco sync` catches configuration drift; `--check` flag for CI integration
- **Modular Tool Integration** — Add tools incrementally with `roboco add` (OMC, Exa.ai, Context7, GitHub MCP, Harness, OpenSpec)

## Quick Start

### Initialize a new project

```bash
npx roboco init
```

This will:
1. Analyze your repository structure and tech stack
2. Conduct an AI interview to understand your preferences
3. Generate `CLAUDE.md`, `.claude/` configuration, and hooks
4. Install required tools (oh-my-claudecode, MCP servers)
5. Set up optional process documents and CI/CD pipelines

### Auto mode (non-interactive)

```bash
npx roboco init --auto
```

AI suggests the optimal setup based on analysis. You just approve or reject.

### Dry run

```bash
npx roboco init --dryrun
```

Analyze and show recommendations without making any changes.

## Commands

| Command | Description |
|---------|-------------|
| `roboco init [path]` | Initialize vibe coding environment with AI interview |
| `roboco install [path]` | Apply existing config for team members (no interview) |
| `roboco update [path]` | Update existing setup with new analysis |
| `roboco status [path]` | Report current vibe coding setup status |
| `roboco doctor` | Diagnose ROBOCO CLI health (version, SDK, dependencies) |
| `roboco config` | View and modify global ROBOCO configuration |
| `roboco add <integration>` | Add a tool post-init (openspec, exa, github, context7, harness) |
| `roboco sync [--check]` | Detect configuration drift (CI-friendly with `--check`) |
| `roboco validate [--fix]` | End-to-end setup validation |
| `roboco audit [--format]` | Vibe coding maturity scoring (100 points, 5 categories) |

## What Gets Generated

### Required (always created)

| Artifact | Description |
|----------|-------------|
| `CLAUDE.md` | AI context document tailored to your repo |
| `.claude/settings.json` | Claude Code settings with stack-specific hooks |
| `.claude/` directory | Commands, skills, and configuration |
| oh-my-claudecode | Multi-agent orchestration (installed as dependency) |

### Optional (selected during interview)

| Artifact | Description |
|----------|-------------|
| OpenSpec | 5-stage vibe coding process documentation framework |
| Exa.ai MCP | Code/technical documentation web search |
| Perplexity MCP | General web search and Q&A (fallback) |
| GitHub MCP | Issue/PR management and code search |
| Context7 MCP | Up-to-date library/framework documentation |
| Harness | Domain-specific agent team design (6 architecture patterns) |
| CI/CD pipeline | Pre-commit hooks + GitHub Actions workflows |
| Process templates | 5-stage vibe coding document templates |

## Tech Stack

- **Language**: TypeScript (ESM)
- **Runtime**: Node.js >= 24
- **CLI Framework**: Commander.js
- **AI Integration**: Claude Code SDK
- **Distribution**: npm (`npx roboco init`)

## Requirements

- Node.js 24 or later
- Claude subscription or API key (required for Claude Code SDK)

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm run test

# Development mode (watch)
npm run dev
```

## Roadmap

### v0.1 — MVP
- 6 core commands: `init`, `install`, `update`, `status`, `doctor`, `config`
- AI interview (Claude Agent SDK) with auto/interactive/dryrun modes
- Stack-agnostic configuration with auto-detection (7 languages, 9 frameworks)
- OMC + MCP servers + Harness + OpenSpec integration
- npm distribution (`npx roboco init`)

### v0.2 — Extensibility
- `add`, `sync`, `validate` commands
- Pre-commit hook generation (stack-specific via husky)
- CLAUDE.md delegates to `claude /init` + `<roboco>` context

### v0.3 — Audit & Automation
- `audit` command (100-point vibe coding maturity scoring)
- Release automation (tag → validate → npm publish → GitHub Release)
- Issue auto-labeling and stale management

### v0.4 — Current
- Existing `.claude/` and `~/.claude/` settings analysis and deep merge
- AI code review on pre-push (Claude Agent SDK)
- DESIGN.md, CONTRIBUTING.md, CHANGELOG.md, LICENSE
- CI paths-ignore for non-executable changes
- 62 tests (unit + integration + E2E)

### Future
- `eject`, `share` commands
- Stack-specific configuration presets
- Community preset/plugin ecosystem

## Contributing

This project is **100% vibe-coded** — every line of code, every test, every document has been written by AI agents. We welcome contributions from both humans and AI.

- **Feature Requests** — Open an issue describing what you want. AI-generated FRs with detailed specs are welcome.
- **Pull Requests** — AI-authored PRs are first-class citizens here. Whether you vibe-coded it with Claude Code, Cursor, Copilot, or any other AI tool, send it.
- **Bug Reports** — Describe the issue. AI-generated reproduction steps are appreciated.

See [CONTRIBUTING.md](CONTRIBUTING.md) for development setup, commit conventions, and the anti-reinvention rule.

## License

MIT

## Links

- [Product Requirements Document](docs/PRD.md)
- [Research Report](docs/research-report.md)
- [Quality Gates](docs/quality-gates.md)
- [Changelog](CHANGELOG.md)
- [Contributing](CONTRIBUTING.md)
