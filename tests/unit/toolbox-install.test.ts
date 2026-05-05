import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, rm, readFile, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('execa', () => ({
  execa: vi.fn(),
}));

import { execa } from 'execa';
import { installToolbox } from '../../src/core/installer.js';
import type { AnalysisResult } from '../../src/types/index.js';

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;

function makeAnalysis(tempDir: string, languages: string[] = ['TypeScript']): AnalysisResult {
  return {
    path: tempDir,
    stack: {
      languages,
      frameworks: [],
      buildTools: [],
      packageManager: 'npm',
      hasTypeScript: languages.includes('TypeScript'),
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
      claudeSettings: null,
      claudeSkills: [],
      claudeCommands: [],
      globalSettings: null,
      globalSkills: [],
    },
    git: { isRepo: true, remoteUrl: null, repoName: 'test', branch: 'main' },
    signals: { hasProto: false },
  };
}

describe('installToolbox', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-toolbox-'));
    execaMock.mockReset();
    execaMock.mockResolvedValue({ stdout: '', stderr: '' });
  });

  it('writes project .claude/settings.json with marketplace + plugins for TypeScript', async () => {
    await installToolbox(makeAnalysis(tempDir));
    const raw = await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8');
    const parsed = JSON.parse(raw);
    expect(parsed.extraKnownMarketplaces['claude-toolbox']).toBeDefined();
    expect(parsed.enabledPlugins['biome-vcs-integration@claude-toolbox']).toBe(true);
    expect(parsed.enabledPlugins['next-action@claude-toolbox']).toBe(true);
  });

  it('runs marketplace add then plugin install per bundle entry', async () => {
    await installToolbox(makeAnalysis(tempDir, ['Go']));
    const calls = execaMock.mock.calls.map((c) => c[1]);
    expect(calls[0]).toEqual(['plugin', 'marketplace', 'add', 'jaeyeom/claude-toolbox']);
    const installArgs = calls.slice(1).map((args) => args[2]);
    expect(installArgs).toContain('next-action@claude-toolbox');
    expect(installArgs).toContain('go-dev@claude-toolbox');
  });

  it('skips plugin installs when marketplace add fails', async () => {
    execaMock.mockReset();
    execaMock.mockRejectedValueOnce(new Error('marketplace failed'));
    const result = await installToolbox(makeAnalysis(tempDir));
    expect(execaMock).toHaveBeenCalledTimes(1);
    expect(result.success).toBe(false);
  });

  it('continues installing remaining plugins when one install fails', async () => {
    execaMock.mockReset();
    execaMock.mockResolvedValueOnce({ stdout: '', stderr: '' }); // marketplace add ok
    execaMock.mockRejectedValueOnce(new Error('plugin install failed')); // first plugin fails
    execaMock.mockResolvedValue({ stdout: '', stderr: '' }); // rest pass
    const result = await installToolbox(makeAnalysis(tempDir));
    expect(execaMock.mock.calls.length).toBeGreaterThan(2);
    expect(result.success).toBe(true);
    expect(result.message).toMatch(/Installed \d+\/\d+/);
  });

  it('preserves existing .claude/settings.json content', async () => {
    await mkdir(join(tempDir, '.claude'), { recursive: true });
    await writeFile(
      join(tempDir, '.claude', 'settings.json'),
      JSON.stringify({ permissions: { allow: ['Read'], deny: [] } }),
    );
    await installToolbox(makeAnalysis(tempDir));
    const parsed = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(parsed.permissions.allow).toEqual(['Read']);
    expect(parsed.extraKnownMarketplaces['claude-toolbox']).toBeDefined();
  });
});
