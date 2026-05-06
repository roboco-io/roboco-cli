import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mkdtemp, rm, mkdir, writeFile, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('execa', () => ({ execa: vi.fn() }));
import { execa } from 'execa';
import { addCommand } from '../../src/commands/add.js';

const execaMock = execa as unknown as ReturnType<typeof vi.fn>;

async function fixture(): Promise<string> {
  const tempDir = await mkdtemp(join(tmpdir(), 'roboco-add-'));
  await mkdir(join(tempDir, '.roboco'));
  await writeFile(
    join(tempDir, '.roboco', 'config.json'),
    JSON.stringify({
      version: '0.1.0',
      createdAt: '2026-05-04T00:00:00.000Z',
      updatedAt: '2026-05-04T00:00:00.000Z',
      analysis: {
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
        git: { isRepo: false, remoteUrl: null, repoName: null, branch: null },
        signals: { hasProto: false },
      },
      interview: {
        setupDomains: { claudeEnv: true, processDocs: false, cicd: false },
        tools: {
          omc: true,
          openspec: false,
          exaAi: false,
          perplexityAsk: false,
          githubMcp: false,
          context7: false,
          harness: false,
          toolbox: false,
        },
        preferences: {},
      },
      installedTools: ['omc'],
    }),
  );
  return tempDir;
}

describe('roboco add toolbox', () => {
  beforeEach(() => {
    execaMock.mockReset();
    execaMock.mockResolvedValue({ stdout: '', stderr: '' });
  });

  it('installs the bundle and writes settings.json', async () => {
    const tempDir = await fixture();
    await addCommand('toolbox', { path: tempDir });
    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.enabledPlugins['biome-vcs-integration@claude-toolbox']).toBe(true);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('marks toolbox enabled in .roboco/config.json', async () => {
    const tempDir = await fixture();
    await addCommand('toolbox', { path: tempDir });
    const cfg = JSON.parse(await readFile(join(tempDir, '.roboco', 'config.json'), 'utf-8'));
    expect(cfg.interview.tools.toolbox).toBe(true);
    expect(cfg.installedTools).toContain('toolbox');
    await rm(tempDir, { recursive: true, force: true });
  });

  it('reports failure cleanly when installToolbox returns result.success === false', async () => {
    const tempDir = await fixture();
    execaMock.mockReset();
    // First call (marketplace add) throws — installToolbox catches it and returns success:false
    execaMock.mockRejectedValueOnce(new Error('marketplace failed'));
    await addCommand('toolbox', { path: tempDir });
    // Even with marketplace add failure, settings.json is written and config.json is updated
    // (per design: settings is source of truth, persists user intent)
    const cfg = JSON.parse(await readFile(join(tempDir, '.roboco', 'config.json'), 'utf-8'));
    expect(cfg.interview.tools.toolbox).toBe(true);
    expect(cfg.installedTools).toContain('toolbox');
    await rm(tempDir, { recursive: true, force: true });
  });
});

describe('roboco add toolbox:<plugin>', () => {
  beforeEach(() => {
    execaMock.mockReset();
    execaMock.mockResolvedValue({ stdout: '', stderr: '' });
  });

  it('installs a single non-overlapping plugin', async () => {
    const tempDir = await fixture();
    await addCommand('toolbox:next-action', { path: tempDir });
    const calls = execaMock.mock.calls.map((c) => c[1]);
    expect(calls).toContainEqual(['plugin', 'install', 'next-action@claude-toolbox']);
    const settings = JSON.parse(await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'));
    expect(settings.enabledPlugins['next-action@claude-toolbox']).toBe(true);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('rejects unknown plugin name', async () => {
    const tempDir = await fixture();
    await addCommand('toolbox:not-a-real-plugin', { path: tempDir });
    expect(process.exitCode).toBe(1);
    process.exitCode = 0;
    await rm(tempDir, { recursive: true, force: true });
  });
});

describe('roboco add toolbox:<overlap-plugin>', () => {
  beforeEach(() => {
    execaMock.mockReset();
    execaMock.mockResolvedValue({ stdout: '', stderr: '' });
  });

  it('records skipGeneratorOutputs override when user accepts drop-replace', async () => {
    const tempDir = await fixture();
    // simulate user accepting the prompt
    const promptModule = await import('../../src/utils/prompt.js');
    vi.spyOn(promptModule, 'confirm').mockResolvedValue(true);

    await addCommand('toolbox:gabyx-githooks-setup', { path: tempDir });

    const cfg = JSON.parse(await readFile(join(tempDir, '.roboco', 'config.json'), 'utf-8'));
    expect(cfg.overrides?.skipGeneratorOutputs).toContain('husky-pre-commit');
    expect(cfg.installedTools).toContain('toolbox:gabyx-githooks-setup');

    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('does not record override when user declines drop-replace', async () => {
    const tempDir = await fixture();
    const promptModule = await import('../../src/utils/prompt.js');
    vi.spyOn(promptModule, 'confirm').mockResolvedValue(false);

    await addCommand('toolbox:gabyx-githooks-setup', { path: tempDir });

    const cfg = JSON.parse(await readFile(join(tempDir, '.roboco', 'config.json'), 'utf-8'));
    expect(cfg.overrides?.skipGeneratorOutputs ?? []).not.toContain('husky-pre-commit');

    vi.restoreAllMocks();
    await rm(tempDir, { recursive: true, force: true });
  });
});
