import { execa } from 'execa';

export async function isGitRepo(path: string): Promise<boolean> {
  try {
    await execa('git', ['rev-parse', '--is-inside-work-tree'], { cwd: path });
    return true;
  } catch {
    return false;
  }
}

export async function getRemoteUrl(path: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['remote', 'get-url', 'origin'], { cwd: path });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}

export async function getRepoName(path: string): Promise<string | null> {
  const url = await getRemoteUrl(path);
  if (!url) return null;
  const match = url.match(/\/([^/]+?)(?:\.git)?$/);
  return match?.[1] ?? null;
}

export async function getBranch(path: string): Promise<string | null> {
  try {
    const { stdout } = await execa('git', ['branch', '--show-current'], { cwd: path });
    return stdout.trim() || null;
  } catch {
    return null;
  }
}
