import { readdir, access } from 'node:fs/promises';
import { join } from 'node:path';
import { fileExists, readJson } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { isGitRepo, getRemoteUrl, getRepoName, getBranch } from '../utils/git.js';
import type {
  AnalysisResult,
  StackInfo,
  RepoStructure,
  ExistingConfig,
  GitInfo,
} from '../types/index.js';

export async function analyze(targetPath: string): Promise<AnalysisResult> {
  try {
    await access(targetPath);
  } catch {
    throw new Error(`Directory not found: ${targetPath}`);
  }
  const [stack, structure, existing, git] = await Promise.all([
    detectStack(targetPath),
    scanStructure(targetPath),
    checkExisting(targetPath),
    getGitInfo(targetPath),
  ]);
  return { path: targetPath, stack, structure, existing, git };
}

async function detectStack(path: string): Promise<StackInfo> {
  const info: StackInfo = {
    languages: [],
    frameworks: [],
    buildTools: [],
    packageManager: null,
    hasTypeScript: false,
  };

  if (await fileExists(join(path, 'package.json'))) {
    info.languages.push('JavaScript');
    info.packageManager = 'npm';
    try {
      const pkg = await readJson<Record<string, unknown>>(join(path, 'package.json'));
      const allDeps = {
        ...(pkg['dependencies'] as Record<string, string> | undefined),
        ...(pkg['devDependencies'] as Record<string, string> | undefined),
      };
      if (allDeps['typescript'] || (await fileExists(join(path, 'tsconfig.json')))) {
        info.hasTypeScript = true;
        info.languages.push('TypeScript');
      }
      const frameworkMap: Record<string, string> = {
        react: 'React',
        vue: 'Vue',
        next: 'Next.js',
        nuxt: 'Nuxt',
        express: 'Express',
        fastify: 'Fastify',
        nestjs: 'NestJS',
        svelte: 'Svelte',
        angular: 'Angular',
      };
      for (const [dep, name] of Object.entries(frameworkMap)) {
        if (allDeps[dep] || allDeps[`@${dep}/core`]) info.frameworks.push(name);
      }
    } catch {
      logger.debug('Failed to parse package.json');
    }

    if (await fileExists(join(path, 'pnpm-lock.yaml'))) info.packageManager = 'pnpm';
    else if (await fileExists(join(path, 'yarn.lock'))) info.packageManager = 'yarn';
    else if (await fileExists(join(path, 'bun.lockb'))) info.packageManager = 'bun';
  }

  if (
    (await fileExists(join(path, 'pyproject.toml'))) ||
    (await fileExists(join(path, 'requirements.txt')))
  ) {
    info.languages.push('Python');
  }
  if (await fileExists(join(path, 'go.mod'))) info.languages.push('Go');
  if (await fileExists(join(path, 'Cargo.toml'))) info.languages.push('Rust');
  if ((await fileExists(join(path, 'pom.xml'))) || (await fileExists(join(path, 'build.gradle')))) {
    info.languages.push('Java');
  }

  return info;
}

async function scanStructure(path: string): Promise<RepoStructure> {
  const entries = await readdir(path, { withFileTypes: true });
  const rootFiles = entries
    .filter((e: { isFile(): boolean; name: string }) => e.isFile())
    .map((e: { name: string }) => e.name);
  const rootDirs = entries
    .filter(
      (e: { isDirectory(): boolean; name: string }) => e.isDirectory() && !e.name.startsWith('.'),
    )
    .map((e: { name: string }) => e.name);

  const sourceCandidates = ['src', 'lib', 'app', 'source'];
  const sourceDir = sourceCandidates.find((d) => rootDirs.includes(d)) ?? null;

  const testCandidates = ['test', 'tests', '__tests__', 'spec'];
  const testDir = testCandidates.find((d) => rootDirs.includes(d)) ?? null;

  const hasMonorepo = rootDirs.includes('packages') || rootDirs.includes('apps');

  return { rootFiles, rootDirs, sourceDir, testDir, hasMonorepo };
}

async function checkExisting(path: string): Promise<ExistingConfig> {
  const { homedir } = await import('node:os');
  const home = homedir();

  const [hasClaude, hasClaudeMd, hasOmc, hasRoboco, hasOpenSpec] = await Promise.all([
    fileExists(join(path, '.claude')),
    fileExists(join(path, 'CLAUDE.md')),
    fileExists(join(path, '.omc')),
    fileExists(join(path, '.roboco')),
    fileExists(join(path, 'openspec')),
  ]);

  // Read project .claude/ contents
  const claudeSettings = await readJsonSafe(join(path, '.claude', 'settings.json'));
  const claudeSkills = await listDirNames(join(path, '.claude', 'skills'));
  const claudeCommands = await listDirNames(join(path, '.claude', 'commands'));

  // Read global ~/.claude/ contents
  const globalSettings = await readJsonSafe(join(home, '.claude', 'settings.json'));
  const globalSkills = await listDirNames(join(home, '.claude', 'skills'));

  return {
    hasClaude,
    hasClaudeMd,
    hasOmc,
    hasRoboco,
    hasOpenSpec,
    claudeSettings,
    claudeSkills,
    claudeCommands,
    globalSettings,
    globalSkills,
  };
}

async function readJsonSafe(path: string): Promise<Record<string, unknown> | null> {
  try {
    return await readJson<Record<string, unknown>>(path);
  } catch {
    return null;
  }
}

async function listDirNames(path: string): Promise<string[]> {
  try {
    const entries = await readdir(path, { withFileTypes: true });
    return entries.filter((e) => e.isDirectory()).map((e) => e.name);
  } catch {
    return [];
  }
}

async function getGitInfo(path: string): Promise<GitInfo> {
  const isRepo = await isGitRepo(path);
  if (!isRepo) return { isRepo: false, remoteUrl: null, repoName: null, branch: null };

  const [remoteUrl, repoName, branch] = await Promise.all([
    getRemoteUrl(path),
    getRepoName(path),
    getBranch(path),
  ]);
  return { isRepo, remoteUrl, repoName, branch };
}
