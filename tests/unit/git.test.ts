import { describe, it, expect } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { execa } from 'execa';
import { isGitRepo, getRemoteUrl, getRepoName, getBranch } from '../../src/utils/git.js';

describe('git utils', () => {
  let tempDir: string;

  it('returns false for non-git directory', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-git-'));
    expect(await isGitRepo(tempDir)).toBe(false);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns true for git directory', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-git-'));
    await execa('git', ['init'], { cwd: tempDir });
    expect(await isGitRepo(tempDir)).toBe(true);
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns null remote for local-only repo', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-git-'));
    await execa('git', ['init'], { cwd: tempDir });
    expect(await getRemoteUrl(tempDir)).toBeNull();
    expect(await getRepoName(tempDir)).toBeNull();
    await rm(tempDir, { recursive: true, force: true });
  });

  it('returns branch name', async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-git-'));
    await execa('git', ['init', '-b', 'main'], { cwd: tempDir });
    expect(await getBranch(tempDir)).toBe('main');
    await rm(tempDir, { recursive: true, force: true });
  });
});
