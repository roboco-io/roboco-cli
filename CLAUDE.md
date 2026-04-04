# CLAUDE.md — ROBOCO CLI

## Project Overview

ROBOCO CLI is an AI-native development scaffolding system that sets up repositories for vibe coding with Claude Code. It analyzes a target repo, conducts an AI-powered interview via Claude Code SDK, and generates tailored configurations.

- **PRD**: [docs/PRD.md](docs/PRD.md)
- **Research**: [docs/research-report.md](docs/research-report.md)
- **Architecture Skill**: `.claude/skills/roboco-architecture/` (auto-loaded when editing src/)
- **Implementation Guide**: `/roboco-implement [module]`

## Tech Stack

- TypeScript (strict, ESM only)
- Node.js >= 24
- Commander.js (CLI framework)
- @anthropic-ai/claude-code-sdk (AI interview)
- tsup (build), vitest (test), ESLint + Prettier (lint)

## Commands

```bash
npm run build        # Build with tsup
npm run dev          # Watch mode
npm run test         # Run tests (vitest)
npm run test:run     # Run tests once
npm run lint         # ESLint
npm run typecheck    # tsc --noEmit
```

## Coding Conventions

- ESM only: use `import/export`, never `require`
- `strict: true` in tsconfig, no `any` types
- File naming: kebab-case (`repo-analyzer.ts`)
- No default exports — use named exports only
- Error messages facing users must be friendly with actionable next steps
- Internal errors: throw with descriptive messages
- Write tests alongside each module in `tests/` mirroring `src/` structure

## Architecture

```
src/
├── index.ts              # CLI entrypoint (Commander setup)
├── commands/             # One file per command (init, install, update, status, doctor, config)
├── core/                 # Business logic (analyzer, interviewer, generator, installer)
├── setup-domains/        # 4 setup domains (claude-env, process-docs, cicd, stack-optimizer)
├── templates/            # Template rendering logic
├── utils/                # Shared utilities (fs, git, logger, prompt)
└── types/                # Type definitions
```

## Implementation Phases

1. **Project setup** → types → utils
2. **Core engines** → analyzer → interviewer → generator → installer
3. **Commands** → init → install → update → status → doctor → config
4. **Setup domains** → claude-env → process-docs → cicd → stack-optimizer
5. **Templates** → claude-md → settings → hooks → cicd → process

## Key Design Decisions

- OMC installed as a whole dependency (not cherry-picked)
- AI interview runs directly in terminal via Claude Code SDK
- Stack-agnostic: common config base with auto-detection
- `init` = first-time setup with interview, `install` = team member applies existing config
- `doctor` checks ROBOCO CLI itself, `status` checks target repo setup
- No `lint` command — static validation of vibe coding "correctness" is impractical
- CLAUDE.md generation delegates to `claude /init`, not custom implementation

## Anti-Reinvention Rule

Before implementing any feature, check if it already exists in:
1. **Claude Code built-in** — `/init`, `/compact`, `/review`, built-in tools (Read, Write, Glob, Grep, Bash)
2. **Claude Code SDK / Agent SDK** — `query()`, hooks, permissions, MCP
3. **OMC** — agents, skills, workflows (ralph, autopilot, ultrawork)
4. **npm ecosystem** — established packages for common tasks

If existing functionality covers 80%+ of the need, **wrap/delegate** instead of reimplementing.
Concrete examples:
- CLAUDE.md generation → `claude /init` (headless) + `<roboco>` tag append
- AI conversation → `@anthropic-ai/claude-agent-sdk` `query()`, not raw API
- MCP server install → `claude mcp add`, not custom installer
- Git hooks → `husky`, not custom scripts
