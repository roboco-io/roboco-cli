import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../src/core/generator.js';
import type { AnalysisResult, InterviewResult } from '../../src/types/index.js';

function makeAnalysis(
  tempDir: string,
  claudeSettings: Record<string, unknown> | null = null,
): AnalysisResult {
  return {
    path: tempDir,
    stack: {
      languages: ['TypeScript'],
      frameworks: [],
      buildTools: [],
      packageManager: 'npm',
      hasTypeScript: true,
    },
    structure: {
      rootFiles: [],
      rootDirs: [],
      sourceDir: 'src',
      testDir: 'tests',
      hasMonorepo: false,
    },
    existing: {
      hasClaude: claudeSettings !== null,
      hasClaudeMd: true,
      hasOmc: false,
      hasRoboco: false,
      hasOpenSpec: false,
      claudeSettings,
      claudeSkills: [],
      claudeCommands: [],
      globalSettings: null,
      globalSkills: [],
    },
    git: { isRepo: true, remoteUrl: null, repoName: 'test', branch: 'main' },
  };
}

const defaultInterview: InterviewResult = {
  setupDomains: { claudeEnv: true, processDocs: false, cicd: false },
  tools: {
    omc: true,
    openspec: false,
    exaAi: false,
    perplexityAsk: false,
    githubMcp: false,
    context7: false,
    harness: false,
  },
  preferences: {},
};

describe('settings.json merge', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-merge-'));
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Test\n');
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('creates fresh settings when none exist', async () => {
    const analysis = makeAnalysis(tempDir, null);
    await generate(tempDir, analysis, defaultInterview);

    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.permissions.allow).toContain('Read');
    expect(settings.permissions.deny).toContain('Bash(rm -rf *)');
    expect(settings.hooks).toBeDefined();
  });

  it('preserves existing permissions and adds ROBOCO defaults', async () => {
    const existing = {
      permissions: {
        allow: ['Bash(docker *)', 'Bash(kubectl *)'],
        deny: ['Bash(rm -rf /)'],
      },
    };
    const analysis = makeAnalysis(tempDir, existing);
    await generate(tempDir, analysis, defaultInterview);

    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    // Existing preserved
    expect(settings.permissions.allow).toContain('Bash(docker *)');
    expect(settings.permissions.allow).toContain('Bash(kubectl *)');
    expect(settings.permissions.deny).toContain('Bash(rm -rf /)');
    // ROBOCO defaults added
    expect(settings.permissions.allow).toContain('Read');
    expect(settings.permissions.allow).toContain('Glob');
    expect(settings.permissions.deny).toContain('Bash(git push --force*)');
  });

  it('does not duplicate permissions on re-run', async () => {
    const existing = {
      permissions: {
        allow: ['Read', 'Write', 'Bash(docker *)'],
        deny: ['Bash(rm -rf *)'],
      },
    };
    const analysis = makeAnalysis(tempDir, existing);
    await generate(tempDir, analysis, defaultInterview);

    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    const readCount = settings.permissions.allow.filter((p: string) => p === 'Read').length;
    expect(readCount).toBe(1);
  });

  it('preserves existing hooks and adds ROBOCO hooks', async () => {
    const existing = {
      permissions: { allow: [], deny: [] },
      hooks: {
        SessionStart: [{ hooks: [{ type: 'command', command: 'echo hello' }] }],
      },
    };
    const analysis = makeAnalysis(tempDir, existing);
    await generate(tempDir, analysis, defaultInterview);

    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    // Existing hooks preserved (not overwritten)
    expect(settings.hooks.SessionStart).toBeDefined();
  });

  it('preserves user config keys ROBOCO does not manage', async () => {
    const existing = {
      permissions: { allow: ['Read'], deny: [] },
      customSetting: 'user-value',
      mcpServers: { myServer: { command: 'npx my-server' } },
    };
    const analysis = makeAnalysis(tempDir, existing);
    await generate(tempDir, analysis, defaultInterview);

    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.customSetting).toBe('user-value');
    expect(settings.mcpServers).toBeDefined();
    expect(settings.mcpServers.myServer.command).toBe('npx my-server');
  });
});
