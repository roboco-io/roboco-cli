import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyze } from '../../src/core/analyzer.js';

describe('analyzer', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-test-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('detects TypeScript project', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: {},
        devDependencies: { typescript: '^5.0.0' },
      }),
    );
    await writeFile(join(tempDir, 'tsconfig.json'), '{}');

    const result = await analyze(tempDir);
    expect(result.stack.languages).toContain('TypeScript');
    expect(result.stack.hasTypeScript).toBe(true);
  });

  it('detects Python project', async () => {
    await writeFile(join(tempDir, 'requirements.txt'), 'flask\n');

    const result = await analyze(tempDir);
    expect(result.stack.languages).toContain('Python');
  });

  it('detects Go project', async () => {
    await writeFile(join(tempDir, 'go.mod'), 'module example\n');

    const result = await analyze(tempDir);
    expect(result.stack.languages).toContain('Go');
  });

  it('detects React framework', async () => {
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({
        dependencies: { react: '^18.0.0' },
      }),
    );

    const result = await analyze(tempDir);
    expect(result.stack.frameworks).toContain('React');
  });

  it('detects monorepo structure', async () => {
    await mkdir(join(tempDir, 'packages'));

    const result = await analyze(tempDir);
    expect(result.structure.hasMonorepo).toBe(true);
  });

  it('detects existing .claude config', async () => {
    await mkdir(join(tempDir, '.claude'));
    await writeFile(join(tempDir, 'CLAUDE.md'), '# Test');

    const result = await analyze(tempDir);
    expect(result.existing.hasClaude).toBe(true);
    expect(result.existing.hasClaudeMd).toBe(true);
  });

  it('throws on nonexistent path', async () => {
    await expect(analyze('/tmp/nonexistent-roboco-path')).rejects.toThrow('Directory not found');
  });

  it('returns empty stack for empty directory', async () => {
    const result = await analyze(tempDir);
    expect(result.stack.languages).toHaveLength(0);
    expect(result.stack.frameworks).toHaveLength(0);
  });

  it('reads existing .claude/settings.json contents', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    const settings = { permissions: { allow: ['Bash(docker *)'] }, hooks: { test: true } };
    await writeFile(join(tempDir, '.claude', 'settings.json'), JSON.stringify(settings));

    const result = await analyze(tempDir);
    expect(result.existing.claudeSettings).not.toBeNull();
    expect((result.existing.claudeSettings as Record<string, unknown>)['hooks']).toEqual({
      test: true,
    });
  });

  it('lists existing .claude/skills/ directories', async () => {
    await mkdir(join(tempDir, '.claude', 'skills', 'my-skill'), { recursive: true });
    await mkdir(join(tempDir, '.claude', 'skills', 'other-skill'), { recursive: true });

    const result = await analyze(tempDir);
    expect(result.existing.claudeSkills).toContain('my-skill');
    expect(result.existing.claudeSkills).toContain('other-skill');
    expect(result.existing.claudeSkills).toHaveLength(2);
  });

  it('lists existing .claude/commands/ directories', async () => {
    await mkdir(join(tempDir, '.claude', 'commands', 'deploy'), { recursive: true });

    const result = await analyze(tempDir);
    expect(result.existing.claudeCommands).toContain('deploy');
  });

  it('returns null settings and empty arrays when no .claude/', async () => {
    const result = await analyze(tempDir);
    expect(result.existing.claudeSettings).toBeNull();
    expect(result.existing.claudeSkills).toHaveLength(0);
    expect(result.existing.claudeCommands).toHaveLength(0);
  });

  it('handles malformed settings.json gracefully', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(join(tempDir, '.claude', 'settings.json'), 'not json{{{');

    const result = await analyze(tempDir);
    expect(result.existing.claudeSettings).toBeNull();
  });
});
