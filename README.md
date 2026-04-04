# ROBOCO CLI

[![CI](https://github.com/roboco-io/roboco-cli/actions/workflows/ci.yml/badge.svg)](https://github.com/roboco-io/roboco-cli/actions/workflows/ci.yml)
[![GitHub release](https://img.shields.io/github/v/release/roboco-io/roboco-cli?include_prereleases)](https://github.com/roboco-io/roboco-cli/releases)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)
[![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue)](https://www.typescriptlang.org)
[![Claude Code](https://img.shields.io/badge/Claude_Code-Plugin-purple)](https://claude.com/claude-code)

> AI-native development scaffolding system for vibe coding with Claude Code

ROBOCO CLI sets up your repository for optimal vibe coding by analyzing your project, conducting an AI-powered interview, and generating a tailored configuration — so every team member works under the same AI-assisted development rules.

## Why ROBOCO?

Vibe coding processes, documentation, and harness configurations should live **alongside your source code**. When any developer joins, the same principles apply. Even team members who don't vibe code get their contributions validated through CI/CD enforcement.

ROBOCO CLI makes this effortless:

```bash
npx roboco init
```

## Features

- **AI-Powered Interview** — Analyzes your repo (stack, structure, existing config) then asks targeted questions via Claude Code SDK to customize the setup
- **Smart Stack Detection** — Automatically detects your tech stack (TypeScript, Python, Go, Rust, Java, etc.) and applies optimized settings
- **Claude Code Environment** — Generates `CLAUDE.md`, `.claude/` settings, Claude Code Hooks, and MCP server configurations
- **Team Consistency** — Every developer who clones the repo gets the identical vibe coding environment via `roboco install`
- **CI/CD Enforcement** — Pre-commit hooks and GitHub Actions workflows enforce vibe coding rules even for non-vibe-coding members
- **5-Stage Process Templates** — Intent → Requirements → Research → Plan → Implement, with documents at each stage

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
| CI/CD pipeline | Pre-commit hooks + GitHub Actions workflows |
| Process templates | 5-stage vibe coding document templates |

## Tech Stack

- **Language**: TypeScript (ESM)
- **Runtime**: Node.js >= 20
- **CLI Framework**: Commander.js
- **AI Integration**: Claude Code SDK
- **Distribution**: npm (`npx roboco init`)

## Requirements

- Node.js 20 or later
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

### MVP (v0.1) — Current
- Core commands: `init`, `install`, `update`, `status`, `doctor`, `config`
- AI interview-based custom setup
- Stack-agnostic configuration with auto-detection
- OMC integration + optional MCP servers
- npm distribution

### v0.2
- `add`, `sync`, `validate` commands
- Stack-specific configuration presets
- Tier 2 MCP servers (Playwright, Snyk, PostgreSQL)

### v0.3
- `audit` command (vibe coding maturity scoring)
- OpenClaw-based automated issue response and release automation

### Future
- `eject`, `share` commands
- Community preset/plugin ecosystem

## License

MIT

## Links

- [Product Requirements Document](docs/PRD.md)
- [Research Report](docs/research-report.md)
- [Ideation](docs/ideation.md)
