import { join } from 'node:path';
import { execa } from 'execa';
import type { AnalysisResult, InterviewResult, OverrideKey, RobocoConfig } from '../types/index.js';
import { ensureDir, fileExists, writeText, readText } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { MARKETPLACE } from './toolbox-bundles.js';

interface GenerateOptions {
  overrides?: { skipGeneratorOutputs?: OverrideKey[] };
}

interface FileOperation {
  path: string;
  content: string;
  description: string;
  overwrite?: boolean;
}

export function mergeToolboxSettings(
  existing: Record<string, unknown>,
  bundle: string[],
): Record<string, unknown> {
  const result = { ...existing };

  const marketplaces = (result['extraKnownMarketplaces'] ?? {}) as Record<string, unknown>;
  const newMarketplaces = { ...marketplaces };
  const existingEntry = newMarketplaces[MARKETPLACE.name] as { source?: unknown } | undefined;
  if (!existingEntry) {
    newMarketplaces[MARKETPLACE.name] = { source: MARKETPLACE.source };
  } else if (JSON.stringify(existingEntry.source) !== JSON.stringify(MARKETPLACE.source)) {
    logger.warn(
      `extraKnownMarketplaces['${MARKETPLACE.name}'] has a custom source — leaving it unchanged.`,
    );
  }
  result['extraKnownMarketplaces'] = newMarketplaces;

  const plugins = (result['enabledPlugins'] ?? {}) as Record<string, boolean>;
  const newPlugins = { ...plugins };
  for (const name of bundle) {
    const key = `${name}@${MARKETPLACE.name}`;
    if (newPlugins[key] !== false) newPlugins[key] = true;
  }
  result['enabledPlugins'] = newPlugins;

  return result;
}

export async function generate(
  targetPath: string,
  analysis: AnalysisResult,
  interviewResult: InterviewResult,
  options: GenerateOptions = {},
): Promise<string[]> {
  const skip = new Set<OverrideKey>(options.overrides?.skipGeneratorOutputs ?? []);
  const files: FileOperation[] = [];

  // Claude Code Environment (required)
  // Step 1: Run claude /init to generate base CLAUDE.md
  await runClaudeInit(targetPath);
  // Step 2: Append ROBOCO context + generate settings/hooks
  await appendRobocoContext(targetPath, analysis, interviewResult, skip);
  // Step 3: Generate .claude/settings.json and hooks
  files.push(...generateClaudeSettings(targetPath, analysis, skip));

  // Process Documents (optional)
  if (interviewResult.setupDomains.processDocs) {
    files.push(...generateProcessDocs(targetPath));
  }

  // CI/CD (optional)
  if (interviewResult.setupDomains.cicd) {
    files.push(...generateCicd(targetPath, analysis, skip));
  }

  // ROBOCO config
  files.push(generateRobocoConfig(targetPath, analysis, interviewResult));

  const created: string[] = [];
  for (const file of files) {
    if ((await fileExists(file.path)) && !file.overwrite) {
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

async function runClaudeInit(targetPath: string): Promise<void> {
  const claudeMdPath = join(targetPath, 'CLAUDE.md');
  if (await fileExists(claudeMdPath)) {
    logger.info('CLAUDE.md already exists — skipping claude /init');
    return;
  }

  try {
    await execa('claude', ['/init'], {
      cwd: targetPath,
      timeout: 30000,
      env: { ...process.env, CLAUDE_CODE_HEADLESS: '1' },
      stdin: 'ignore',
    });
    // Verify claude /init actually created the file
    if (await fileExists(claudeMdPath)) {
      logger.success('CLAUDE.md generated via claude /init');
      return;
    }
  } catch {
    // Fall through to template generation
  }

  logger.warn('claude /init did not produce CLAUDE.md — generating template');
  const { basename } = await import('node:path');
  await writeText(
    claudeMdPath,
    `# ${basename(targetPath)}\n\n## Project Overview\n\nDescribe your project here.\n`,
  );
}

async function appendRobocoContext(
  targetPath: string,
  analysis: AnalysisResult,
  interviewResult: InterviewResult,
  skip: Set<OverrideKey>,
): Promise<void> {
  if (skip.has('claude-md-roboco-block')) return;
  const claudeMdPath = join(targetPath, 'CLAUDE.md');
  if (!(await fileExists(claudeMdPath))) return;

  const existing = await readText(claudeMdPath);
  if (existing.includes('<roboco>')) {
    logger.info('ROBOCO context already present in CLAUDE.md — skipping');
    return;
  }

  const tools = Object.entries(interviewResult.tools)
    .filter(([, v]) => v)
    .map(([k]) => k)
    .join(', ');

  const robocoBlock = `
<roboco>
## Vibe Coding Process

This project uses ROBOCO for AI-native development with the 5-stage vibe coding process:
1. **Intent** — Communicate what you want to build
2. **Requirements** — Define requirements through deep interview
3. **Research** — Investigate approaches and tools
4. **Plan** — Create an implementation plan
5. **Implement** — Build with AI assistance

Each stage produces documents in \`docs/vibe-coding/\`. You can restart from any stage.

## ROBOCO Configuration

- **Stack**: ${[...analysis.stack.languages, ...analysis.stack.frameworks].join(', ') || 'Not detected'}
- **Tools**: ${tools}
- **Config**: \`.roboco/config.json\`

Run \`roboco status\` to check setup, \`roboco audit\` for maturity scoring.
</roboco>
`;

  await writeText(claudeMdPath, existing.trimEnd() + '\n' + robocoBlock);
  logger.success('ROBOCO context appended to CLAUDE.md');
}

function generateClaudeSettings(
  targetPath: string,
  analysis: AnalysisResult,
  skip: Set<OverrideKey>,
): FileOperation[] {
  const hooks = generateHooksForStack(analysis.stack.languages);
  const allowList = [
    'Read',
    'Write',
    'Edit',
    'Glob',
    'Grep',
    'Bash(npm run *)',
    'Bash(git status*)',
    'Bash(git diff*)',
    'Bash(git log*)',
  ];
  const robocoDefaults: Record<string, unknown> = {
    permissions: skip.has('claude-deny-list')
      ? { allow: allowList }
      : {
          allow: allowList,
          deny: ['Bash(rm -rf *)', 'Bash(git push --force*)', 'Bash(git reset --hard*)'],
        },
    ...(Object.keys(hooks).length > 0 ? { hooks } : {}),
  };

  // Merge with existing settings instead of overwriting
  const existing = analysis.existing.claudeSettings;
  const merged = existing ? deepMergeSettings(existing, robocoDefaults) : robocoDefaults;

  return [
    {
      path: join(targetPath, '.claude', 'settings.json'),
      content: JSON.stringify(merged, null, 2) + '\n',
      description: '.claude/settings.json',
      overwrite: true,
    },
  ];
}

function deepMergeSettings(
  existing: Record<string, unknown>,
  defaults: Record<string, unknown>,
): Record<string, unknown> {
  const result = { ...existing };

  for (const [key, value] of Object.entries(defaults)) {
    if (key === 'permissions' && result[key] && typeof result[key] === 'object') {
      // Merge permission arrays (union, no duplicates)
      const existingPerms = result[key] as Record<string, unknown>;
      const defaultPerms = value as Record<string, unknown>;
      result[key] = {
        allow: mergeArrays(
          (existingPerms['allow'] as string[]) ?? [],
          (defaultPerms['allow'] as string[]) ?? [],
        ),
        deny: mergeArrays(
          (existingPerms['deny'] as string[]) ?? [],
          (defaultPerms['deny'] as string[]) ?? [],
        ),
      };
    } else if (!(key in result)) {
      // Only add keys that don't exist — don't overwrite user's config
      result[key] = value;
    }
  }

  return result;
}

function mergeArrays(a: string[], b: string[]): string[] {
  return [...new Set([...a, ...b])];
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

function generateCicd(
  targetPath: string,
  analysis: AnalysisResult,
  skip: Set<OverrideKey>,
): FileOperation[] {
  const files: FileOperation[] = [];

  // GitHub Actions workflow
  if (!skip.has('ci-workflow-vibe-coding-check')) {
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
  }

  // Pre-commit hook via husky
  if (!skip.has('husky-pre-commit')) {
    const lintCmd = getLintCommand(analysis.stack.languages);
    files.push({
      path: join(targetPath, '.husky', 'pre-commit'),
      content: `${lintCmd}\n`,
      description: 'Pre-commit hook',
    });
  }

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
