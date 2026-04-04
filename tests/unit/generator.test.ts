import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { generate } from '../../src/core/generator.js';
import type { AnalysisResult, InterviewResult } from '../../src/types/index.js';

function makeAnalysis(overrides: Partial<AnalysisResult> = {}): AnalysisResult {
  return {
    path: '/tmp/test',
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
      hasClaude: false,
      hasClaudeMd: false,
      hasOmc: false,
      hasRoboco: false,
      hasOpenSpec: false,
    },
    git: {
      isRepo: true,
      remoteUrl: 'https://github.com/test/repo.git',
      repoName: 'repo',
      branch: 'main',
    },
    ...overrides,
  };
}

function makeInterview(overrides: Partial<InterviewResult> = {}): InterviewResult {
  return {
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
    ...overrides,
  };
}

describe('generator', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-gen-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('generates CLAUDE.md with project name from git', async () => {
    const analysis = makeAnalysis({ path: tempDir });
    const created = await generate(tempDir, analysis, makeInterview());
    const claudeMd = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('# repo');
    expect(claudeMd).toContain('TypeScript');
    expect(created.length).toBeGreaterThanOrEqual(2);
  });

  it('generates .claude/settings.json with hooks for TypeScript', async () => {
    const analysis = makeAnalysis({ path: tempDir });
    await generate(tempDir, analysis, makeInterview());
    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(JSON.stringify(settings.hooks)).toContain('prettier');
  });

  it('generates Python hooks for Python projects', async () => {
    const analysis = makeAnalysis({
      path: tempDir,
      stack: {
        languages: ['Python'],
        frameworks: [],
        buildTools: [],
        packageManager: null,
        hasTypeScript: false,
      },
    });
    await generate(tempDir, analysis, makeInterview());
    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(JSON.stringify(settings.hooks)).toContain('black');
  });

  it('generates process docs when selected', async () => {
    const analysis = makeAnalysis({ path: tempDir });
    const interview = makeInterview({
      setupDomains: { claudeEnv: true, processDocs: true, cicd: false },
    });
    const created = await generate(tempDir, analysis, interview);
    const intentFile = await readFile(
      join(tempDir, 'docs', 'vibe-coding', '01-intent.md'),
      'utf-8',
    );
    expect(intentFile).toContain('Intent');
    expect(created.some((f) => f.includes('01-intent.md'))).toBe(true);
  });

  it('generates CI/CD when selected', async () => {
    const analysis = makeAnalysis({ path: tempDir });
    const interview = makeInterview({
      setupDomains: { claudeEnv: true, processDocs: false, cicd: true },
    });
    await generate(tempDir, analysis, interview);
    const workflow = await readFile(
      join(tempDir, '.github', 'workflows', 'vibe-coding-check.yml'),
      'utf-8',
    );
    expect(workflow).toContain('CLAUDE.md');
  });

  it('generates .roboco/config.json', async () => {
    const analysis = makeAnalysis({ path: tempDir });
    await generate(tempDir, analysis, makeInterview());
    const config = JSON.parse(await readFile(join(tempDir, '.roboco', 'config.json'), 'utf-8'));
    expect(config.version).toBe('0.1.0');
    expect(config.interview.tools.omc).toBe(true);
  });

  it('skips existing files without overwriting', async () => {
    const analysis = makeAnalysis({ path: tempDir });
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const original = '# Original content';
    const { writeFile: wf } = await import('node:fs/promises');
    await wf(join(tempDir, 'CLAUDE.md'), original);

    await generate(tempDir, analysis, makeInterview());
    const content = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toBe(original);
  });
});
