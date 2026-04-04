import { join } from 'node:path';
import type { AnalysisResult, InterviewResult, RobocoConfig } from '../types/index.js';
import { ensureDir, fileExists, writeText } from '../utils/fs.js';
import { logger } from '../utils/logger.js';

interface FileOperation {
  path: string;
  content: string;
  description: string;
}

export async function generate(
  targetPath: string,
  analysis: AnalysisResult,
  interviewResult: InterviewResult,
): Promise<string[]> {
  const files: FileOperation[] = [];

  // Claude Code Environment (required)
  files.push(...generateClaudeEnv(targetPath, analysis, interviewResult));

  // Process Documents (optional)
  if (interviewResult.setupDomains.processDocs) {
    files.push(...generateProcessDocs(targetPath));
  }

  // CI/CD (optional)
  if (interviewResult.setupDomains.cicd) {
    files.push(...generateCicd(targetPath, analysis));
  }

  // ROBOCO config
  files.push(generateRobocoConfig(targetPath, analysis, interviewResult));

  const created: string[] = [];
  for (const file of files) {
    if (await fileExists(file.path)) {
      logger.warn(`Skipped (exists): ${relative(targetPath, file.path)}`);
      continue;
    }
    await ensureDir(join(file.path, '..'));
    await writeText(file.path, file.content);
    logger.success(`Created: ${relative(targetPath, file.path)}`);
    created.push(file.path);
  }

  return created;
}

function relative(base: string, full: string): string {
  return full.startsWith(base) ? full.slice(base.length + 1) : full;
}

function generateClaudeEnv(
  targetPath: string,
  analysis: AnalysisResult,
  _interviewResult: InterviewResult,
): FileOperation[] {
  const files: FileOperation[] = [];
  const projectName = analysis.git.repoName ?? 'My Project';
  const stackList =
    [...analysis.stack.languages, ...analysis.stack.frameworks].join(', ') || 'Not detected';

  files.push({
    path: join(targetPath, 'CLAUDE.md'),
    content: `# ${projectName}

## Project Overview
<!-- Describe your project here -->

## Tech Stack
${stackList}

## Development Commands
\`\`\`bash
# Build
# Test
# Lint
\`\`\`

## Coding Conventions
<!-- Add your coding conventions here -->

## Vibe Coding Process
This project follows the 5-stage vibe coding process:
1. **Intent** — Communicate what you want to build
2. **Requirements** — Define requirements through deep interview
3. **Research** — Investigate approaches and tools
4. **Plan** — Create an implementation plan
5. **Implement** — Build with AI assistance

## Non-Goals
<!-- List things explicitly out of scope -->
`,
    description: 'CLAUDE.md',
  });

  const hooks = generateHooksForStack(analysis.stack.languages);
  const settings = {
    permissions: {
      allow: [
        'Read',
        'Write',
        'Edit',
        'Glob',
        'Grep',
        'Bash(npm run *)',
        'Bash(git status*)',
        'Bash(git diff*)',
        'Bash(git log*)',
      ],
      deny: ['Bash(rm -rf *)', 'Bash(git push --force*)', 'Bash(git reset --hard*)'],
    },
    ...(Object.keys(hooks).length > 0 ? { hooks } : {}),
  };

  files.push({
    path: join(targetPath, '.claude', 'settings.json'),
    content: JSON.stringify(settings, null, 2) + '\n',
    description: '.claude/settings.json',
  });

  return files;
}

function generateHooksForStack(languages: string[]): Record<string, unknown> {
  const hooks: Record<string, unknown> = {};

  if (languages.includes('TypeScript') || languages.includes('JavaScript')) {
    hooks['PostToolUse'] = [
      {
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command: 'npx prettier --write $CLAUDE_FILE_PATH 2>/dev/null || true',
          },
        ],
      },
    ];
  } else if (languages.includes('Python')) {
    hooks['PostToolUse'] = [
      {
        matcher: 'Write|Edit',
        hooks: [
          {
            type: 'command',
            command:
              'black $CLAUDE_FILE_PATH 2>/dev/null || ruff format $CLAUDE_FILE_PATH 2>/dev/null || true',
          },
        ],
      },
    ];
  } else if (languages.includes('Go')) {
    hooks['PostToolUse'] = [
      {
        matcher: 'Write|Edit',
        hooks: [{ type: 'command', command: 'gofmt -w $CLAUDE_FILE_PATH 2>/dev/null || true' }],
      },
    ];
  }

  return hooks;
}

function generateProcessDocs(targetPath: string): FileOperation[] {
  const stages = [
    {
      file: '01-intent.md',
      title: 'Intent',
      desc: 'Communicate what you want to build clearly and concisely.',
    },
    {
      file: '02-requirements.md',
      title: 'Requirements',
      desc: 'Define detailed requirements through deep interview.',
    },
    {
      file: '03-research.md',
      title: 'Research',
      desc: 'Investigate approaches, tools, and existing solutions.',
    },
    { file: '04-plan.md', title: 'Plan', desc: 'Create a step-by-step implementation plan.' },
    { file: '05-implement.md', title: 'Implement', desc: 'Build the solution with AI assistance.' },
  ];

  return stages.map(({ file, title, desc }) => ({
    path: join(targetPath, 'docs', 'vibe-coding', file),
    content: `# Stage: ${title}\n\n${desc}\n\n## Checklist\n\n- [ ] \n`,
    description: `Process template: ${title}`,
  }));
}

function generateCicd(targetPath: string, analysis: AnalysisResult): FileOperation[] {
  const files: FileOperation[] = [];

  // GitHub Actions workflow
  files.push({
    path: join(targetPath, '.github', 'workflows', 'vibe-coding-check.yml'),
    content: `name: Vibe Coding Check

on:
  pull_request:
    branches: [main, dev]

jobs:
  check:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - name: Check CLAUDE.md exists
        run: test -f CLAUDE.md
      - name: Check .claude directory
        run: test -d .claude
`,
    description: 'GitHub Actions workflow',
  });

  // Pre-commit hook via husky
  const lintCmd = getLintCommand(analysis.stack.languages);
  files.push({
    path: join(targetPath, '.husky', 'pre-commit'),
    content: `${lintCmd}\n`,
    description: 'Pre-commit hook',
  });

  return files;
}

function getLintCommand(languages: string[]): string {
  if (languages.includes('TypeScript') || languages.includes('JavaScript')) {
    return 'npx lint-staged';
  } else if (languages.includes('Python')) {
    return 'ruff check --fix . && ruff format .';
  } else if (languages.includes('Go')) {
    return 'gofmt -l . && go vet ./...';
  } else if (languages.includes('Rust')) {
    return 'cargo fmt --check && cargo clippy';
  }
  return 'echo "No lint configured"';
}

function generateRobocoConfig(
  targetPath: string,
  analysis: AnalysisResult,
  interviewResult: InterviewResult,
): FileOperation {
  const now = new Date().toISOString();
  const config: RobocoConfig = {
    version: '0.1.0',
    createdAt: now,
    updatedAt: now,
    analysis,
    interview: interviewResult,
    installedTools: ['omc'],
  };

  return {
    path: join(targetPath, '.roboco', 'config.json'),
    content: JSON.stringify(config, null, 2) + '\n',
    description: '.roboco/config.json',
  };
}
