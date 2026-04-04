import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import { analyze } from '../../src/core/analyzer.js';
import { interview } from '../../src/core/interviewer.js';
import { generate } from '../../src/core/generator.js';
import { fileExists } from '../../src/utils/fs.js';

describe('init pipeline (analyze → interview → generate)', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-integ-'));
    await execa('git', ['init', '-b', 'main'], { cwd: tempDir });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        name: 'test-project',
        dependencies: { react: '^18' },
        devDependencies: { typescript: '^5' },
      }),
    );
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');
    await mkdir(join(tempDir, 'src'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('full pipeline produces valid ROBOCO setup', async () => {
    // Step 1: Analyze
    const analysis = await analyze(tempDir);
    expect(analysis.stack.languages).toContain('TypeScript');
    expect(analysis.stack.frameworks).toContain('React');
    expect(analysis.git.isRepo).toBe(true);

    // Step 2: Interview (auto)
    const result = await interview(analysis, { auto: true });
    expect(result.tools.omc).toBe(true);
    expect(result.setupDomains.claudeEnv).toBe(true);

    // Step 3: Generate
    const created = await generate(tempDir, analysis, result);
    expect(created.length).toBeGreaterThan(0);

    // Verify artifacts
    expect(await fileExists(join(tempDir, 'CLAUDE.md'))).toBe(true);
    expect(await fileExists(join(tempDir, '.claude', 'settings.json'))).toBe(true);
    expect(await fileExists(join(tempDir, '.roboco', 'config.json'))).toBe(true);

    // Verify CLAUDE.md contains project info
    const claudeMd = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(claudeMd).toContain('TypeScript');

    // Verify settings.json has TypeScript hooks
    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.permissions).toBeDefined();
    expect(settings.hooks).toBeDefined();

    // Verify config is valid
    const config = JSON.parse(await readFile(join(tempDir, '.roboco', 'config.json'), 'utf-8'));
    expect(config.version).toBe('0.1.0');
    expect(config.analysis.stack.languages).toContain('TypeScript');
  });

  it('pipeline with full options generates all artifacts', async () => {
    const analysis = await analyze(tempDir);
    const result = await interview(analysis, { auto: true });
    // Auto mode enables processDocs + cicd for git repos
    expect(result.setupDomains.processDocs).toBe(true);
    expect(result.setupDomains.cicd).toBe(true);

    await generate(tempDir, analysis, result);

    // Process docs
    expect(await fileExists(join(tempDir, 'docs', 'vibe-coding', '01-intent.md'))).toBe(true);
    expect(await fileExists(join(tempDir, 'docs', 'vibe-coding', '05-implement.md'))).toBe(true);

    // CI/CD
    expect(await fileExists(join(tempDir, '.github', 'workflows', 'vibe-coding-check.yml'))).toBe(
      true,
    );
  });

  it('pipeline handles Python project correctly', async () => {
    // Replace with Python project
    await rm(join(tempDir, 'package.json'));
    await rm(join(tempDir, 'tsconfig.json'));
    await writeFile(join(tempDir, 'requirements.txt'), 'flask\ndjango\n');

    const analysis = await analyze(tempDir);
    expect(analysis.stack.languages).toContain('Python');
    expect(analysis.stack.hasTypeScript).toBe(false);

    const result = await interview(analysis, { auto: true });
    await generate(tempDir, analysis, result);

    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(JSON.stringify(settings.hooks)).toContain('black');
  });

  it('pipeline preserves existing CLAUDE.md', async () => {
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Existing content\nDo not overwrite');

    const analysis = await analyze(tempDir);
    const result = await interview(analysis, { auto: true });
    await generate(tempDir, analysis, result);

    const content = await readFile(join(tempDir, 'CLAUDE.md'), 'utf-8');
    expect(content).toContain('Existing content');
  });
});
