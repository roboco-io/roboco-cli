import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, readFile, writeFile } from 'node:fs/promises';
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

// Pre-create CLAUDE.md to skip `claude /init` in tests
async function seedClaudeMd(dir: string): Promise<void> {
  await writeFile(join(dir, 'CLAUDE.md'), '# Test Project\n\n## Overview\nTest project.\n');
}

describe('generator', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-gen-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('appends roboco context to existing CLAUDE.md', async () => {
    await seedClaudeMd(tempDir);
    const analysis = makeAnalysis({ path: tempDir });
    await generate(tempDir, analysis, makeInterview());
    const claudeMd = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('# Test Project');
    expect(claudeMd).toContain('<roboco>');
    expect(claudeMd).toContain('TypeScript');
    expect(claudeMd).toContain('</roboco>');
  });

  it('generates .claude/settings.json with hooks for TypeScript', async () => {
    await seedClaudeMd(tempDir);
    const analysis = makeAnalysis({ path: tempDir });
    await generate(tempDir, analysis, makeInterview());
    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.hooks).toBeDefined();
    expect(JSON.stringify(settings.hooks)).toContain('prettier');
  });

  it('generates Python hooks for Python projects', async () => {
    await seedClaudeMd(tempDir);
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
    await seedClaudeMd(tempDir);
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

  it('generates CI/CD with pre-commit hook when selected', async () => {
    await seedClaudeMd(tempDir);
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
    const hook = await readFile(join(tempDir, '.husky', 'pre-commit'), 'utf-8');
    expect(hook).toContain('lint-staged');
  });

  it('generates .roboco/config.json', async () => {
    await seedClaudeMd(tempDir);
    const analysis = makeAnalysis({ path: tempDir });
    await generate(tempDir, analysis, makeInterview());
    const config = JSON.parse(await readFile(join(tempDir, '.roboco', 'config.json'), 'utf-8'));
    expect(config.version).toBe('0.1.0');
    expect(config.interview.tools.omc).toBe(true);
  });

  it('does not duplicate roboco context on re-run', async () => {
    await seedClaudeMd(tempDir);
    const analysis = makeAnalysis({ path: tempDir });
    const interview = makeInterview();
    await generate(tempDir, analysis, interview);
    await generate(tempDir, analysis, interview);
    const content = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    const count = (content.match(/<roboco>/g) || []).length;
    expect(count).toBe(1);
  });
});
