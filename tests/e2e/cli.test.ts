import { describe, it, expect, beforeAll, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import { fileExists } from '../../src/utils/fs.js';

const CLI = join(import.meta.dirname, '..', '..', 'dist', 'index.js');

describe('CLI E2E', () => {
  let tempDir: string;

  beforeAll(async () => {
    // Ensure built
    await execa('npm', ['run', 'build'], { cwd: join(import.meta.dirname, '..', '..') });
  });

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-e2e-'));
    await execa('git', ['init', '-b', 'main'], { cwd: tempDir });
    await writeFile(
      join(tempDir, 'package.json'),
      JSON.stringify({ name: 'e2e-test', dependencies: {} }),
    );
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('roboco --version', () => {
    it('prints version', async () => {
      const { stdout } = await execa('node', [CLI, '--version']);
      expect(stdout.trim()).toBe('0.1.0');
    });
  });

  describe('roboco --help', () => {
    it('shows all commands', async () => {
      const { stdout } = await execa('node', [CLI, '--help']);
      expect(stdout).toContain('init');
      expect(stdout).toContain('install');
      expect(stdout).toContain('update');
      expect(stdout).toContain('status');
      expect(stdout).toContain('doctor');
      expect(stdout).toContain('config');
    });
  });

  describe('roboco init --dryrun', () => {
    it('analyzes without creating files', async () => {
      const result = await execa('node', [CLI, 'init', '--dryrun', tempDir], { all: true });
      const output = result.all ?? '';
      expect(output).toContain('Dry run complete');
      expect(await fileExists(join(tempDir, 'CLAUDE.md'))).toBe(false);
    });
  });

  describe('roboco init --auto', () => {
    it('creates all expected files', async () => {
      const result = await execa('node', [CLI, 'init', '--auto', tempDir], {
        all: true,
        timeout: 120000,
      });
      const output = result.all ?? '';
      expect(output).toContain('ROBOCO initialized successfully');
      expect(await fileExists(join(tempDir, 'CLAUDE.md'))).toBe(true);
      expect(await fileExists(join(tempDir, '.claude', 'settings.json'))).toBe(true);
      expect(await fileExists(join(tempDir, '.roboco', 'config.json'))).toBe(true);
    });
  });

  describe('roboco init on non-existent path', () => {
    it('exits with error', async () => {
      const result = await execa('node', [CLI, 'init', '/tmp/nonexistent-roboco-e2e'], {
        reject: false,
        all: true,
      });
      expect(result.exitCode).not.toBe(0);
      const output = result.all ?? '';
      expect(output).toContain('Directory not found');
    });
  });

  describe('roboco install without init', () => {
    it('exits with error message', async () => {
      const result = await execa('node', [CLI, 'install', tempDir], { reject: false, all: true });
      expect(result.exitCode).not.toBe(0);
      const output = result.all ?? '';
      expect(output).toContain('roboco init');
    });
  });

  describe('roboco init → install flow', () => {
    it('install works after init', async () => {
      await execa('node', [CLI, 'init', '--auto', tempDir], { all: true, timeout: 120000 });
      expect(await fileExists(join(tempDir, '.roboco', 'config.json'))).toBe(true);

      const result = await execa('node', [CLI, 'install', tempDir], { all: true, timeout: 120000 });
      const output = result.all ?? '';
      expect(output).toContain('Environment ready');
    });
  });

  describe('roboco status', () => {
    it('shows status for initialized repo', async () => {
      await execa('node', [CLI, 'init', '--auto', tempDir], { timeout: 120000 });
      const { stdout } = await execa('node', [CLI, 'status', tempDir]);
      expect(stdout).toContain('ROBOCO Status Report');
      expect(stdout).toContain('CLAUDE.md');
      expect(stdout).toContain('ROBOCO config');
    });

    it('shows status for uninitialized repo', async () => {
      const { stdout } = await execa('node', [CLI, 'status', tempDir]);
      expect(stdout).toContain('ROBOCO Status Report');
      expect(stdout).toContain('✗');
    });
  });

  describe('roboco doctor', () => {
    it('runs diagnostics', async () => {
      const result = await execa('node', [CLI, 'doctor'], { reject: false });
      expect(result.stdout).toContain('ROBOCO Doctor');
      expect(result.stdout).toContain('Node.js version');
    });
  });

  describe('roboco config', () => {
    it('shows default config', async () => {
      const { stdout } = await execa('node', [CLI, 'config']);
      expect(stdout).toContain('defaultTools');
      expect(stdout).toContain('omc');
    });

    it('set and get a value', async () => {
      await execa('node', [CLI, 'config', '--set', 'telemetry=true']);
      const { stdout } = await execa('node', [CLI, 'config', '--get', 'telemetry']);
      expect(stdout.trim()).toBe('true');
    });

    it('rejects prototype pollution keys', async () => {
      const result = await execa('node', [CLI, 'config', '--set', '__proto__.polluted=true'], {
        reject: false,
      });
      expect(result.exitCode).not.toBe(0);
    });
  });
});
