# claude-toolbox Integration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Phase 1 claude-toolbox marketplace integration to ROBOCO CLI — stack-aware bundle resolution, project-scoped settings.json merge, init/add surfacing, and overlap-skip default with opt-in drop-replace.

**Architecture:** New `core/toolbox-bundles.ts` defines bundle data and a pure `resolveBundle` function. New `installToolbox` / `installSingleToolboxPlugin` in `core/installer.ts` follow the existing `installOMC` pattern (subprocess via `execa`, return `InstallResult`). New `mergeToolboxSettings` extends `core/generator.ts`'s settings merge. `commands/add.ts` parses `toolbox` and `toolbox:<plugin>` forms. Types extended in `types/{interview,config,analysis}.ts`.

**Tech Stack:** TypeScript (strict ESM), Node 24, Commander, execa, vitest.

**Spec:** [docs/superpowers/specs/2026-05-04-claude-toolbox-integration-design.md](../specs/2026-05-04-claude-toolbox-integration-design.md)

---

## File Map

**New files:**
- `src/core/toolbox-bundles.ts` — bundle data, `resolveBundle`, `OVERLAPPING_PLUGINS`, `OVERLAP_REMEDIATION` registry
- `tests/unit/toolbox-bundles.test.ts` — unit tests for `resolveBundle`
- `tests/unit/toolbox-install.test.ts` — unit tests for `installToolbox` and `installSingleToolboxPlugin` (subprocess mocked)
- `tests/unit/toolbox-add.test.ts` — unit tests for `roboco add toolbox` and `roboco add toolbox:<plugin>` parsing/dispatch

**Modified files:**
- `src/types/interview.ts` — add `toolbox: boolean` to `ToolSelection`
- `src/types/config.ts` — add `overrides?: { skipGeneratorOutputs?: OverrideKey[] }` to `RobocoConfig`
- `src/types/analysis.ts` — add `signals: RepoSignals` to `AnalysisResult`
- `src/core/analyzer.ts` — detect `.proto` files, populate `signals.hasProto`
- `src/core/generator.ts` — add `mergeToolboxSettings`, consult `config.overrides` to skip emit branches
- `src/core/installer.ts` — add `installToolbox`, `installSingleToolboxPlugin`; call `installToolbox` when `tools.toolbox` is true
- `src/core/interviewer.ts` — add toolbox question to interactive/auto/AI paths
- `src/commands/add.ts` — add `toolbox` to `KNOWN_TOOLS`; parse `toolbox:<plugin>` form

---

## Task 1: Add type definitions

**Files:**
- Modify: `src/types/interview.ts`
- Modify: `src/types/config.ts`
- Modify: `src/types/analysis.ts`

- [ ] **Step 1: Extend `ToolSelection` with `toolbox`**

Edit `src/types/interview.ts`:

```ts
export interface ToolSelection {
  omc: true;
  openspec: boolean;
  exaAi: boolean;
  perplexityAsk: boolean;
  githubMcp: boolean;
  context7: boolean;
  harness: boolean;
  toolbox: boolean;
}
```

- [ ] **Step 2: Add `RepoSignals` and extend `AnalysisResult`**

Edit `src/types/analysis.ts` — add the interface and the field:

```ts
export interface RepoSignals {
  hasProto: boolean;
}

export interface AnalysisResult {
  path: string;
  stack: StackInfo;
  structure: RepoStructure;
  existing: ExistingConfig;
  git: GitInfo;
  signals: RepoSignals;
}
```

- [ ] **Step 3: Re-export `RepoSignals` from `types/index.ts`**

Edit `src/types/index.ts`:

```ts
export type {
  StackInfo,
  RepoStructure,
  ExistingConfig,
  GitInfo,
  AnalysisResult,
  RepoSignals,
} from './analysis.js';
```

- [ ] **Step 4: Add overrides schema to `RobocoConfig`**

Edit `src/types/config.ts`:

```ts
import type { AnalysisResult } from './analysis.js';
import type { InterviewResult } from './interview.js';

export type OverrideKey =
  | 'husky-pre-commit'
  | 'ci-workflow-vibe-coding-check'
  | 'claude-deny-list'
  | 'claude-md-roboco-block';

export interface RobocoConfig {
  version: string;
  createdAt: string;
  updatedAt: string;
  analysis: AnalysisResult;
  interview: InterviewResult;
  installedTools: string[];
  overrides?: {
    skipGeneratorOutputs?: OverrideKey[];
  };
}
```

- [ ] **Step 5: Re-export `OverrideKey` from `types/index.ts`**

```ts
export type { RobocoConfig, GlobalConfig, OverrideKey } from './config.js';
```

- [ ] **Step 6: Run typecheck — expect failures in callers**

Run: `npm run typecheck`
Expected: TypeScript reports missing `toolbox` and `signals` properties in `interviewer.ts`, `commands/init.ts`, test fixtures, etc. Note the failures — Tasks 2–8 fix them.

- [ ] **Step 7: Commit**

```bash
git add src/types/
git commit -m "Add types for toolbox integration

ToolSelection.toolbox, RepoSignals.hasProto, RobocoConfig.overrides."
```

---

## Task 2: Bundle resolution module

**Files:**
- Create: `src/core/toolbox-bundles.ts`
- Create: `tests/unit/toolbox-bundles.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/toolbox-bundles.test.ts`:

```ts
import { describe, it, expect } from 'vitest';
import { resolveBundle, MARKETPLACE, CORE_BUNDLE, OVERLAPPING_PLUGINS } from '../../src/core/toolbox-bundles.js';

describe('resolveBundle', () => {
  it('returns core bundle for stacks with no overlay', () => {
    expect(resolveBundle(['Python'], { hasProto: false })).toEqual(CORE_BUNDLE);
  });

  it('adds go-dev for Go stack', () => {
    const result = resolveBundle(['Go'], { hasProto: false });
    expect(result).toEqual([...CORE_BUNDLE, 'go-dev']);
  });

  it('adds biome-vcs-integration for TypeScript', () => {
    const result = resolveBundle(['TypeScript'], { hasProto: false });
    expect(result).toEqual([...CORE_BUNDLE, 'biome-vcs-integration']);
  });

  it('adds biome-vcs-integration for JavaScript', () => {
    const result = resolveBundle(['JavaScript'], { hasProto: false });
    expect(result).toEqual([...CORE_BUNDLE, 'biome-vcs-integration']);
  });

  it('does not duplicate when both TypeScript and JavaScript detected', () => {
    const result = resolveBundle(['TypeScript', 'JavaScript'], { hasProto: false });
    expect(result.filter((p) => p === 'biome-vcs-integration')).toHaveLength(1);
  });

  it('adds protobuf-dev when hasProto signal is true', () => {
    const result = resolveBundle(['Go'], { hasProto: true });
    expect(result).toContain('protobuf-dev');
    expect(result).toContain('go-dev');
  });

  it('excludes overlapping plugins from defaults', () => {
    const result = resolveBundle(['Go', 'TypeScript'], { hasProto: true });
    for (const overlap of OVERLAPPING_PLUGINS) {
      expect(result).not.toContain(overlap);
    }
  });

  it('returns marketplace metadata pointing at jaeyeom/claude-toolbox', () => {
    expect(MARKETPLACE.name).toBe('claude-toolbox');
    expect(MARKETPLACE.source).toEqual({ source: 'github', repo: 'jaeyeom/claude-toolbox' });
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/toolbox-bundles.test.ts`
Expected: FAIL with "Cannot find module '../../src/core/toolbox-bundles.js'"

- [ ] **Step 3: Implement the module**

Create `src/core/toolbox-bundles.ts`:

```ts
export const MARKETPLACE = {
  name: 'claude-toolbox',
  source: { source: 'github', repo: 'jaeyeom/claude-toolbox' },
} as const;

export const CORE_BUNDLE: readonly string[] = [
  'next-action',
  'todo',
  'gh-issue-resolver',
  'semgrep-review',
  'sandbox-helpers',
  'makefile-workflow',
];

export const STACK_OVERLAYS: Record<string, string[]> = {
  Go: ['go-dev'],
  TypeScript: ['biome-vcs-integration'],
  JavaScript: ['biome-vcs-integration'],
};

export const SIGNAL_OVERLAYS: Record<string, string[]> = {
  hasProto: ['protobuf-dev'],
};

export const OVERLAPPING_PLUGINS = new Set<string>([
  'claude-md',
  'gabyx-githooks-setup',
  'git-guardrails',
  'ci-workflow',
]);

export interface ResolveSignals {
  hasProto: boolean;
}

export function resolveBundle(languages: string[], signals: ResolveSignals): string[] {
  const stackOverlay = languages.flatMap((l) => STACK_OVERLAYS[l] ?? []);
  const signalOverlay = (Object.entries(signals) as Array<[keyof ResolveSignals, boolean]>)
    .filter(([, on]) => on)
    .flatMap(([key]) => SIGNAL_OVERLAYS[key] ?? []);
  return [...new Set<string>([...CORE_BUNDLE, ...stackOverlay, ...signalOverlay])].filter(
    (p) => !OVERLAPPING_PLUGINS.has(p),
  );
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/toolbox-bundles.test.ts`
Expected: PASS — all 8 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/toolbox-bundles.ts tests/unit/toolbox-bundles.test.ts
git commit -m "Add toolbox bundle resolution

Stack-aware resolveBundle with core/stack/signal overlays and overlap exclusion."
```

---

## Task 3: Detect protobuf signal in analyzer

**Files:**
- Modify: `src/core/analyzer.ts`
- Modify: `tests/unit/analyzer.test.ts`

- [ ] **Step 1: Read existing analyzer test for style**

Run: `head -40 tests/unit/analyzer.test.ts` and note the fixture-temp-dir pattern.

- [ ] **Step 2: Write the failing test**

Add to `tests/unit/analyzer.test.ts` (in the appropriate describe block — match existing style; if unsure, add a new describe block at the bottom):

```ts
import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { analyze } from '../../src/core/analyzer.js';

describe('analyzer signals', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-signal-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('hasProto is false when no .proto files exist', async () => {
    const result = await analyze(tempDir);
    expect(result.signals.hasProto).toBe(false);
  });

  it('hasProto is true when a .proto file exists at root', async () => {
    await writeFile(join(tempDir, 'service.proto'), 'syntax = "proto3";\n');
    const result = await analyze(tempDir);
    expect(result.signals.hasProto).toBe(true);
  });

  it('hasProto is true when a .proto file exists in a subdirectory', async () => {
    await mkdir(join(tempDir, 'proto'));
    await writeFile(join(tempDir, 'proto', 'service.proto'), 'syntax = "proto3";\n');
    const result = await analyze(tempDir);
    expect(result.signals.hasProto).toBe(true);
  });
});
```

- [ ] **Step 3: Run test to verify it fails**

Run: `npx vitest run tests/unit/analyzer.test.ts -t "analyzer signals"`
Expected: FAIL — `result.signals` is undefined.

- [ ] **Step 4: Implement signal detection**

Edit `src/core/analyzer.ts`. Add a `detectSignals` function and wire it into `analyze`:

```ts
import type {
  AnalysisResult,
  StackInfo,
  RepoStructure,
  ExistingConfig,
  GitInfo,
  RepoSignals,
} from '../types/index.js';

export async function analyze(targetPath: string): Promise<AnalysisResult> {
  try {
    await access(targetPath);
  } catch {
    throw new Error(`Directory not found: ${targetPath}`);
  }
  const [stack, structure, existing, git, signals] = await Promise.all([
    detectStack(targetPath),
    scanStructure(targetPath),
    checkExisting(targetPath),
    getGitInfo(targetPath),
    detectSignals(targetPath),
  ]);
  return { path: targetPath, stack, structure, existing, git, signals };
}

async function detectSignals(rootPath: string): Promise<RepoSignals> {
  const hasProto = await containsExtension(rootPath, '.proto', 4);
  return { hasProto };
}

async function containsExtension(
  rootPath: string,
  ext: string,
  maxDepth: number,
): Promise<boolean> {
  const ignore = new Set(['.git', 'node_modules', 'dist', 'build', '.next', 'target', 'vendor']);
  async function walk(dir: string, depth: number): Promise<boolean> {
    if (depth > maxDepth) return false;
    let entries;
    try {
      entries = await readdir(dir, { withFileTypes: true });
    } catch {
      return false;
    }
    for (const e of entries) {
      if (e.isFile() && e.name.endsWith(ext)) return true;
    }
    for (const e of entries) {
      if (e.isDirectory() && !ignore.has(e.name) && !e.name.startsWith('.')) {
        if (await walk(join(dir, e.name), depth + 1)) return true;
      }
    }
    return false;
  }
  return walk(rootPath, 0);
}
```

- [ ] **Step 5: Run new tests + existing tests**

Run: `npx vitest run tests/unit/analyzer.test.ts`
Expected: PASS — both new "analyzer signals" tests and all pre-existing analyzer tests pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/analyzer.ts tests/unit/analyzer.test.ts
git commit -m "Detect .proto files in analyzer signals

Adds AnalysisResult.signals.hasProto used by toolbox bundle resolution."
```

---

## Task 4: Settings.json merge for toolbox marketplace + plugins

**Files:**
- Modify: `src/core/generator.ts`
- Modify: `tests/unit/settings-merge.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/settings-merge.test.ts` (extend the existing describe block):

```ts
import { mergeToolboxSettings } from '../../src/core/generator.js';

describe('mergeToolboxSettings', () => {
  it('writes marketplace + enabledPlugins on empty settings', () => {
    const result = mergeToolboxSettings({}, ['next-action', 'todo']);
    expect(result['extraKnownMarketplaces']).toEqual({
      'claude-toolbox': { source: { source: 'github', repo: 'jaeyeom/claude-toolbox' } },
    });
    expect(result['enabledPlugins']).toEqual({
      'next-action@claude-toolbox': true,
      'todo@claude-toolbox': true,
    });
  });

  it('preserves unrelated existing keys', () => {
    const existing = { permissions: { allow: ['Read'], deny: [] } };
    const result = mergeToolboxSettings(existing, ['next-action']);
    expect(result['permissions']).toEqual({ allow: ['Read'], deny: [] });
  });

  it('does not overwrite explicit false in enabledPlugins', () => {
    const existing = { enabledPlugins: { 'next-action@claude-toolbox': false } };
    const result = mergeToolboxSettings(existing, ['next-action', 'todo']);
    expect(result['enabledPlugins']).toEqual({
      'next-action@claude-toolbox': false,
      'todo@claude-toolbox': true,
    });
  });

  it('is idempotent on re-run with same bundle', () => {
    const first = mergeToolboxSettings({}, ['next-action']);
    const second = mergeToolboxSettings(first, ['next-action']);
    expect(second).toEqual(first);
  });

  it('preserves an existing matching marketplace entry', () => {
    const existing = {
      extraKnownMarketplaces: {
        'claude-toolbox': { source: { source: 'github', repo: 'jaeyeom/claude-toolbox' } },
      },
    };
    const result = mergeToolboxSettings(existing, []);
    expect(result['extraKnownMarketplaces']).toEqual(existing.extraKnownMarketplaces);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/settings-merge.test.ts -t "mergeToolboxSettings"`
Expected: FAIL — `mergeToolboxSettings` is not exported.

- [ ] **Step 3: Implement and export `mergeToolboxSettings`**

Edit `src/core/generator.ts`. Add the export at module scope:

```ts
import { MARKETPLACE } from './toolbox-bundles.js';

export function mergeToolboxSettings(
  existing: Record<string, unknown>,
  bundle: string[],
): Record<string, unknown> {
  const result = { ...existing };

  const marketplaces = ((result['extraKnownMarketplaces'] ?? {}) as Record<string, unknown>);
  const newMarketplaces = { ...marketplaces };
  if (!newMarketplaces[MARKETPLACE.name]) {
    newMarketplaces[MARKETPLACE.name] = { source: MARKETPLACE.source };
  }
  result['extraKnownMarketplaces'] = newMarketplaces;

  const plugins = ((result['enabledPlugins'] ?? {}) as Record<string, boolean>);
  const newPlugins = { ...plugins };
  for (const name of bundle) {
    const key = `${name}@${MARKETPLACE.name}`;
    if (newPlugins[key] !== false) newPlugins[key] = true;
  }
  result['enabledPlugins'] = newPlugins;

  return result;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/settings-merge.test.ts`
Expected: PASS — new tests + all pre-existing tests pass.

- [ ] **Step 5: Commit**

```bash
git add src/core/generator.ts tests/unit/settings-merge.test.ts
git commit -m "Add mergeToolboxSettings to generator

Writes extraKnownMarketplaces + enabledPlugins respecting explicit false."
```

---

## Task 5: installToolbox subprocess flow

**Files:**
- Modify: `src/core/installer.ts`
- Create: `tests/unit/toolbox-install.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/toolbox-install.test.ts`:

```ts
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
    stack: { languages, frameworks: [], buildTools: [], packageManager: 'npm', hasTypeScript: languages.includes('TypeScript') },
    structure: { rootFiles: [], rootDirs: [], sourceDir: 'src', testDir: 'tests', hasMonorepo: false },
    existing: { hasClaude: false, hasClaudeMd: false, hasOmc: false, hasRoboco: false, hasOpenSpec: false, claudeSettings: null, claudeSkills: [], claudeCommands: [], globalSettings: null, globalSkills: [] },
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/toolbox-install.test.ts`
Expected: FAIL — `installToolbox` is not exported from `installer.ts`.

- [ ] **Step 3: Implement `installToolbox`**

Edit `src/core/installer.ts`. Add at module scope:

```ts
import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import type { AnalysisResult, ToolSelection } from '../types/index.js';
import { resolveBundle, MARKETPLACE } from './toolbox-bundles.js';
import { mergeToolboxSettings } from './generator.js';

export async function installToolbox(analysis: AnalysisResult): Promise<InstallResult> {
  const bundle = resolveBundle(analysis.stack.languages, analysis.signals);

  // 1. Write project-scoped settings.json (source of truth — survives subprocess failure)
  await writeProjectSettings(analysis.path, bundle);

  // 2. Subprocess: marketplace add
  try {
    await execa('claude', ['plugin', 'marketplace', 'add', `${MARKETPLACE.source.repo}`], {
      timeout: 30000,
    });
  } catch {
    logger.warn(
      `claude-toolbox: marketplace add failed. Run manually: claude plugin marketplace add ${MARKETPLACE.source.repo}`,
    );
    return {
      tool: 'claude-toolbox',
      success: false,
      message: 'Marketplace add failed — settings.json written, install skipped',
    };
  }

  // 3. Subprocess: per-plugin install
  let installed = 0;
  for (const plugin of bundle) {
    try {
      await execa('claude', ['plugin', 'install', `${plugin}@${MARKETPLACE.name}`], {
        timeout: 60000,
      });
      installed++;
    } catch {
      logger.warn(`claude-toolbox: install of ${plugin} failed`);
    }
  }

  return {
    tool: 'claude-toolbox',
    success: installed > 0,
    message: `Installed ${installed}/${bundle.length} plugins. Teammates: run \`roboco install\` to enable.`,
  };
}

async function writeProjectSettings(targetPath: string, bundle: string[]): Promise<void> {
  const settingsPath = join(targetPath, '.claude', 'settings.json');
  await mkdir(join(targetPath, '.claude'), { recursive: true });
  let existing: Record<string, unknown> = {};
  try {
    existing = JSON.parse(await readFile(settingsPath, 'utf-8')) as Record<string, unknown>;
  } catch {
    // file does not exist or is invalid — start fresh
  }
  const merged = mergeToolboxSettings(existing, bundle);
  await writeFile(settingsPath, JSON.stringify(merged, null, 2) + '\n');
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/toolbox-install.test.ts`
Expected: PASS — all 5 tests green.

- [ ] **Step 5: Commit**

```bash
git add src/core/installer.ts tests/unit/toolbox-install.test.ts
git commit -m "Add installToolbox: settings-first, marketplace add, per-plugin install

Settings.json written first as source of truth; subprocess install is
convenience for the initiating user."
```

---

## Task 6: Wire `installToolbox` into the install router

**Files:**
- Modify: `src/core/installer.ts`

- [ ] **Step 1: Read current `installTools` signature**

Run: `head -30 src/core/installer.ts`
Note that `installTools` currently takes only `tools: ToolSelection`. We need to thread `analysis` through so `installToolbox` can read `signals` and `path`.

- [ ] **Step 2: Update `installTools` signature**

Edit `src/core/installer.ts`. Change the signature and dispatch:

```ts
export async function installTools(
  tools: ToolSelection,
  analysis: AnalysisResult,
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];
  results.push(await installOMC());
  if (tools.exaAi) results.push(await installMCP('exa', 'npx -y exa-mcp-server', 'EXA_API_KEY'));
  if (tools.perplexityAsk)
    results.push(
      await installMCP('perplexity-ask', 'npx -y @anthropic-ai/perplexity-ask', 'PERPLEXITY_API_KEY'),
    );
  if (tools.githubMcp)
    results.push(
      await installMCP('github', 'npx -y @modelcontextprotocol/server-github', 'GITHUB_TOKEN'),
    );
  if (tools.context7)
    results.push(await installMCPSimple('context7', 'npx -y @upstash/context7-mcp@latest'));
  if (tools.openspec) results.push(await installOpenSpec());
  if (tools.harness) results.push(await installHarness());
  if (tools.toolbox) results.push(await installToolbox(analysis));
  return results;
}
```

- [ ] **Step 3: Update all callers of `installTools`**

Find every caller. Run: `grep -rn "installTools(" src/ tests/`

For each caller, pass `analysis` as second argument. Likely callers:
- `src/commands/init.ts` — pass `analysis` from `analyze(targetPath)`
- `src/commands/install.ts` — read analysis from `.roboco/config.json`
- `src/commands/add.ts` — needs `analysis`; update Task 8 will handle this fully — for now, `await analyze(targetPath)` to obtain it
- `src/commands/update.ts` — pass `analysis`

For each, edit the relevant lines accordingly. Show diff per file:

```ts
// Before
await installTools(interview.tools);
// After
await installTools(interview.tools, analysis);
```

- [ ] **Step 4: Run typecheck**

Run: `npm run typecheck`
Expected: PASS — no TS errors.

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS — existing tests still pass; toolbox tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/
git commit -m "Wire installToolbox into installTools router

Threads analysis through installTools so toolbox can read signals and path."
```

---

## Task 7: Interview integration (interactive + auto + AI)

**Files:**
- Modify: `src/core/interviewer.ts`
- Modify: `tests/unit/interviewer.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/interviewer.test.ts`:

```ts
describe('interviewer toolbox integration', () => {
  it('autoInterview defaults toolbox to true', async () => {
    const { interview } = await import('../../src/core/interviewer.js');
    const result = await interview(
      {
        path: '/tmp/x',
        stack: { languages: ['TypeScript'], frameworks: [], buildTools: [], packageManager: 'npm', hasTypeScript: true },
        structure: { rootFiles: [], rootDirs: [], sourceDir: 'src', testDir: 'tests', hasMonorepo: false },
        existing: { hasClaude: false, hasClaudeMd: false, hasOmc: false, hasRoboco: false, hasOpenSpec: false, claudeSettings: null, claudeSkills: [], claudeCommands: [], globalSettings: null, globalSkills: [] },
        git: { isRepo: false, remoteUrl: null, repoName: null, branch: null },
        signals: { hasProto: false },
      },
      { auto: true },
    );
    expect(result.tools.toolbox).toBe(true);
  });
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/interviewer.test.ts -t "toolbox integration"`
Expected: FAIL — `result.tools.toolbox` is undefined.

- [ ] **Step 3: Update `autoInterview`**

Edit `src/core/interviewer.ts` `autoInterview` return:

```ts
return {
  setupDomains: { claudeEnv: true, processDocs: true, cicd: analysis.git.isRepo },
  tools: {
    omc: true,
    openspec: true,
    exaAi: false,
    perplexityAsk: false,
    githubMcp: analysis.git.remoteUrl?.includes('github.com') ?? false,
    context7: analysis.stack.languages.length > 0,
    harness: hasWebProject || analysis.structure.hasMonorepo,
    toolbox: true,
  },
  preferences: { autoGenerated: true, stack: analysis.stack },
};
```

- [ ] **Step 4: Update `interactiveInterview`**

In `src/core/interviewer.ts`, add a question after the existing `harness` question. Compose the prompt with the detected overlay so the user sees what will be installed:

```ts
const overlayHints: string[] = [];
if (analysis.stack.languages.includes('Go')) overlayHints.push('go-dev');
if (analysis.stack.languages.includes('TypeScript') || analysis.stack.languages.includes('JavaScript')) {
  overlayHints.push('biome-vcs-integration');
}
if (analysis.signals.hasProto) overlayHints.push('protobuf-dev');
const overlayMsg = overlayHints.length > 0 ? ` (also: ${overlayHints.join(', ')})` : '';
const toolbox = await confirm(
  `  claude-toolbox bundle${overlayMsg} (next-action, todo, gh-issue-resolver, semgrep-review, sandbox-helpers, makefile-workflow)?`,
);
```

Add `toolbox` to the returned `tools` object.

- [ ] **Step 5: Update `parseAiResult`**

Edit the JSON parse block to read `parsed.tools?.toolbox`:

```ts
tools: {
  omc: true,
  openspec: parsed.tools?.openspec ?? false,
  exaAi: parsed.tools?.exaAi ?? false,
  perplexityAsk: parsed.tools?.perplexityAsk ?? false,
  githubMcp: parsed.tools?.githubMcp ?? false,
  context7: parsed.tools?.context7 ?? false,
  harness: parsed.tools?.harness ?? false,
  toolbox: parsed.tools?.toolbox ?? true,
},
```

- [ ] **Step 6: Update the AI system prompt JSON schema**

In `aiInterview`, edit the `systemPrompt` template to include `toolbox`:

```ts
{
  "setupDomains": { "claudeEnv": true, "processDocs": boolean, "cicd": boolean },
  "tools": { "omc": true, "openspec": boolean, "exaAi": boolean, "perplexityAsk": boolean, "githubMcp": boolean, "context7": boolean, "harness": boolean, "toolbox": boolean },
  "preferences": {}
}
```

- [ ] **Step 7: Run all tests**

Run: `npm test`
Expected: PASS — new interviewer test green; existing pass.

- [ ] **Step 8: Commit**

```bash
git add src/core/interviewer.ts tests/unit/interviewer.test.ts
git commit -m "Add toolbox to interview (interactive, auto, AI)

Default true in auto/AI; interactive prompt shows detected stack overlay."
```

---

## Task 8: `roboco add toolbox` bundle path

**Files:**
- Modify: `src/commands/add.ts`
- Create: `tests/unit/toolbox-add.test.ts`

- [ ] **Step 1: Write the failing test**

Create `tests/unit/toolbox-add.test.ts`:

```ts
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
        stack: { languages: ['TypeScript'], frameworks: [], buildTools: [], packageManager: 'npm', hasTypeScript: true },
        structure: { rootFiles: [], rootDirs: [], sourceDir: 'src', testDir: 'tests', hasMonorepo: false },
        existing: { hasClaude: false, hasClaudeMd: false, hasOmc: false, hasRoboco: false, hasOpenSpec: false, claudeSettings: null, claudeSkills: [], claudeCommands: [], globalSettings: null, globalSkills: [] },
        git: { isRepo: false, remoteUrl: null, repoName: null, branch: null },
        signals: { hasProto: false },
      },
      interview: {
        setupDomains: { claudeEnv: true, processDocs: false, cicd: false },
        tools: { omc: true, openspec: false, exaAi: false, perplexityAsk: false, githubMcp: false, context7: false, harness: false, toolbox: false },
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
    const settings = JSON.parse(
      await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'),
    );
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
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/toolbox-add.test.ts -t "roboco add toolbox"`
Expected: FAIL — toolbox is not in `KNOWN_TOOLS`.

- [ ] **Step 3: Add `toolbox` to `KNOWN_TOOLS` and dispatch path**

Edit `src/commands/add.ts`:

```ts
import { resolve } from 'node:path';
import ora from 'ora';
import { fileExists, readJson, writeJson } from '../utils/fs.js';
import { installToolbox } from '../core/installer.js';
import { logger } from '../utils/logger.js';
import type { RobocoConfig, ToolSelection } from '../types/index.js';

const KNOWN_TOOLS: Record<string, { key: keyof ToolSelection; description: string }> = {
  // ... existing entries ...
  toolbox: { key: 'toolbox', description: 'claude-toolbox bundle (stack-aware)' },
};
```

Then in `addCommand`, add a branch *before* the existing `installTools` call:

```ts
if (integration.toLowerCase() === 'toolbox') {
  const spinner = ora('Installing claude-toolbox bundle...').start();
  const result = await installToolbox(config.analysis);
  spinner.succeed('claude-toolbox bundle install complete');
  if (result.success) logger.success(`${result.tool}: ${result.message}`);
  else logger.warn(`${result.tool}: ${result.message}`);

  config.interview.tools.toolbox = true;
  config.updatedAt = new Date().toISOString();
  if (!config.installedTools.includes('toolbox')) config.installedTools.push('toolbox');
  await writeJson(configPath, config);
  logger.success('Configuration updated.');
  return;
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npx vitest run tests/unit/toolbox-add.test.ts`
Expected: PASS — both tests green.

- [ ] **Step 5: Commit**

```bash
git add src/commands/add.ts tests/unit/toolbox-add.test.ts
git commit -m "Add 'roboco add toolbox' bundle install path

Reads analysis from .roboco/config.json, installs bundle, updates config."
```

---

## Task 9: `roboco add toolbox:<plugin>` parsing and non-overlap install

**Files:**
- Modify: `src/commands/add.ts`
- Modify: `src/core/installer.ts`
- Modify: `tests/unit/toolbox-add.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/toolbox-add.test.ts`:

```ts
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
    const settings = JSON.parse(
      await readFile(join(tempDir, '.claude', 'settings.json'), 'utf-8'),
    );
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/toolbox-add.test.ts -t "toolbox:<plugin>"`
Expected: FAIL — parsing for the colon form not implemented.

- [ ] **Step 3: Add a known-plugins catalog to `toolbox-bundles.ts`**

Edit `src/core/toolbox-bundles.ts`. Add at the bottom:

```ts
export const KNOWN_PLUGINS = new Set<string>([
  ...CORE_BUNDLE,
  ...Object.values(STACK_OVERLAYS).flat(),
  ...Object.values(SIGNAL_OVERLAYS).flat(),
  ...OVERLAPPING_PLUGINS,
  // Catalog-only entries (in marketplace but not in any default bundle)
  'apply-figma-make',
  'cloudflare-macos-fix',
  'create-lang-dev-skill',
  'jira-commands',
  'jira-edit-description',
]);
```

- [ ] **Step 4: Implement `installSingleToolboxPlugin` (non-overlap path only)**

Edit `src/core/installer.ts`. Add:

```ts
import { KNOWN_PLUGINS, OVERLAPPING_PLUGINS } from './toolbox-bundles.js';

export async function installSingleToolboxPlugin(
  name: string,
  targetPath: string,
): Promise<InstallResult> {
  if (!KNOWN_PLUGINS.has(name)) {
    return { tool: `claude-toolbox:${name}`, success: false, message: `Unknown plugin: ${name}` };
  }

  if (OVERLAPPING_PLUGINS.has(name)) {
    // Overlap path filled in by Task 10
    return { tool: `claude-toolbox:${name}`, success: false, message: 'Overlap path not yet implemented' };
  }

  await writeProjectSettings(targetPath, [name]);

  try {
    await execa('claude', ['plugin', 'install', `${name}@${MARKETPLACE.name}`], { timeout: 60000 });
    return { tool: `claude-toolbox:${name}`, success: true, message: 'Installed' };
  } catch {
    return { tool: `claude-toolbox:${name}`, success: false, message: 'Install failed' };
  }
}
```

- [ ] **Step 5: Add the parsing branch in `addCommand`**

Edit `src/commands/add.ts`. Before the `KNOWN_TOOLS` lookup, add:

```ts
if (integration.toLowerCase().startsWith('toolbox:')) {
  const pluginName = integration.slice('toolbox:'.length);
  if (!(await fileExists(configPath))) {
    logger.error('This repository has not been initialized with ROBOCO.');
    logger.info('Run "roboco init" first.');
    process.exitCode = 1;
    return;
  }
  const config = await readJson<RobocoConfig>(configPath);
  const result = await installSingleToolboxPlugin(pluginName, targetPath);
  if (result.success) {
    logger.success(`${result.tool}: ${result.message}`);
    config.updatedAt = new Date().toISOString();
    if (!config.installedTools.includes(`toolbox:${pluginName}`)) {
      config.installedTools.push(`toolbox:${pluginName}`);
    }
    await writeJson(configPath, config);
  } else {
    logger.error(`${result.tool}: ${result.message}`);
    process.exitCode = 1;
  }
  return;
}
```

(Note: this branch must run **before** the existing `targetPath`/`configPath` setup — adjust the function structure so `targetPath` and `configPath` are computed before this branch.)

- [ ] **Step 6: Refactor for branch ordering**

Move `targetPath` and `configPath` initialization to the top of `addCommand`, immediately after the empty-integration check:

```ts
export async function addCommand(
  integration: string | undefined,
  options: { path?: string },
): Promise<void> {
  if (!integration) {
    /* existing list-print logic */
    return;
  }

  const targetPath = resolve(options.path ?? '.');
  const configPath = resolve(targetPath, '.roboco', 'config.json');

  if (integration.toLowerCase().startsWith('toolbox:')) { /* see Step 5 */ }
  if (integration.toLowerCase() === 'toolbox') { /* Task 8 */ }

  // existing KNOWN_TOOLS dispatch follows
}
```

- [ ] **Step 7: Run tests**

Run: `npx vitest run tests/unit/toolbox-add.test.ts`
Expected: PASS — both new tests green; pre-existing `roboco add toolbox` tests still pass.

- [ ] **Step 8: Commit**

```bash
git add src/commands/add.ts src/core/installer.ts src/core/toolbox-bundles.ts tests/unit/toolbox-add.test.ts
git commit -m "Add 'roboco add toolbox:<plugin>' single-plugin install (non-overlap)

Recognizes toolbox: prefix, validates against KNOWN_PLUGINS catalog,
installs a single plugin via subprocess. Overlap path is Task 10."
```

---

## Task 10: Overlap remediation registry + drop-replace prompt

**Files:**
- Modify: `src/core/toolbox-bundles.ts`
- Modify: `src/core/installer.ts`
- Modify: `src/commands/add.ts`
- Modify: `tests/unit/toolbox-add.test.ts`

- [ ] **Step 1: Write the failing test**

Append to `tests/unit/toolbox-add.test.ts`:

```ts
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/toolbox-add.test.ts -t "overlap-plugin"`
Expected: FAIL — currently returns "Overlap path not yet implemented".

- [ ] **Step 3: Add overlap remediation registry**

Edit `src/core/toolbox-bundles.ts`. Append:

```ts
import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { OverrideKey } from '../types/index.js';

export interface OverlapRemediation {
  description: string;           // shown in the prompt
  overrideKey: OverrideKey;       // recorded in .roboco/config.json
  cleanup: (targetPath: string) => Promise<void>;
}

export const OVERLAP_REMEDIATION: Record<string, OverlapRemediation> = {
  'gabyx-githooks-setup': {
    description: '.husky/pre-commit',
    overrideKey: 'husky-pre-commit',
    cleanup: async (targetPath: string) => {
      await rm(join(targetPath, '.husky', 'pre-commit'), { force: true });
    },
  },
  'ci-workflow': {
    description: '.github/workflows/vibe-coding-check.yml',
    overrideKey: 'ci-workflow-vibe-coding-check',
    cleanup: async (targetPath: string) => {
      await rm(join(targetPath, '.github', 'workflows', 'vibe-coding-check.yml'), { force: true });
    },
  },
  'git-guardrails': {
    description: '.claude/settings.json deny entries',
    overrideKey: 'claude-deny-list',
    // Cleanup is non-trivial (in-place edit of settings.json deny list).
    // For Phase 1, we record the override and let the user clean manually.
    // Generator skip-on-override (Task 11) prevents future re-emission.
    cleanup: async () => { /* no-op; future-runs respect override */ },
  },
  'claude-md': {
    description: '<roboco> block in CLAUDE.md',
    overrideKey: 'claude-md-roboco-block',
    cleanup: async () => { /* no-op; future-runs respect override */ },
  },
};
```

- [ ] **Step 4: Implement overlap path in `installSingleToolboxPlugin`**

Edit `src/core/installer.ts`. Replace the overlap stub:

```ts
import { KNOWN_PLUGINS, OVERLAPPING_PLUGINS, OVERLAP_REMEDIATION } from './toolbox-bundles.js';
import { confirm } from '../utils/prompt.js';
import type { RobocoConfig } from '../types/index.js';

export async function installSingleToolboxPlugin(
  name: string,
  targetPath: string,
  config: RobocoConfig,
): Promise<{ result: InstallResult; configChanged: boolean }> {
  if (!KNOWN_PLUGINS.has(name)) {
    return {
      result: { tool: `claude-toolbox:${name}`, success: false, message: `Unknown plugin: ${name}` },
      configChanged: false,
    };
  }

  let configChanged = false;

  if (OVERLAPPING_PLUGINS.has(name)) {
    const remediation = OVERLAP_REMEDIATION[name];
    if (!remediation) {
      return {
        result: { tool: `claude-toolbox:${name}`, success: false, message: `No remediation for overlap: ${name}` },
        configChanged: false,
      };
    }
    const accepted = await confirm(
      `This replaces ROBOCO's ${remediation.description}. Drop ROBOCO's version?`,
      false,
    );
    if (accepted) {
      try {
        await remediation.cleanup(targetPath);
      } catch {
        logger.warn(`Cleanup of ${remediation.description} failed — continuing`);
      }
      config.overrides ??= {};
      config.overrides.skipGeneratorOutputs ??= [];
      if (!config.overrides.skipGeneratorOutputs.includes(remediation.overrideKey)) {
        config.overrides.skipGeneratorOutputs.push(remediation.overrideKey);
      }
      configChanged = true;
    } else {
      logger.warn('Both will coexist — manual cleanup may be needed.');
    }
  }

  await writeProjectSettings(targetPath, [name]);

  try {
    await execa('claude', ['plugin', 'install', `${name}@${MARKETPLACE.name}`], { timeout: 60000 });
    return {
      result: { tool: `claude-toolbox:${name}`, success: true, message: 'Installed' },
      configChanged,
    };
  } catch {
    return {
      result: { tool: `claude-toolbox:${name}`, success: false, message: 'Install failed' },
      configChanged,
    };
  }
}
```

- [ ] **Step 5: Update `addCommand` to use the new return shape**

Edit `src/commands/add.ts`. Update the toolbox: branch:

```ts
if (integration.toLowerCase().startsWith('toolbox:')) {
  const pluginName = integration.slice('toolbox:'.length);
  if (!(await fileExists(configPath))) {
    logger.error('This repository has not been initialized with ROBOCO.');
    logger.info('Run "roboco init" first.');
    process.exitCode = 1;
    return;
  }
  const config = await readJson<RobocoConfig>(configPath);
  const { result, configChanged } = await installSingleToolboxPlugin(pluginName, targetPath, config);
  if (result.success) {
    logger.success(`${result.tool}: ${result.message}`);
    config.updatedAt = new Date().toISOString();
    if (!config.installedTools.includes(`toolbox:${pluginName}`)) {
      config.installedTools.push(`toolbox:${pluginName}`);
    }
    await writeJson(configPath, config);
  } else {
    logger.error(`${result.tool}: ${result.message}`);
    if (configChanged) await writeJson(configPath, config);  // persist override even if install fails
    process.exitCode = 1;
  }
  return;
}
```

- [ ] **Step 6: Run tests**

Run: `npx vitest run tests/unit/toolbox-add.test.ts`
Expected: PASS — overlap-plugin accept/decline tests green; non-overlap tests still green.

- [ ] **Step 7: Commit**

```bash
git add src/core/toolbox-bundles.ts src/core/installer.ts src/commands/add.ts tests/unit/toolbox-add.test.ts
git commit -m "Add overlap remediation for opt-in toolbox plugins

Drop-replace prompt records skipGeneratorOutputs override; cleanup
handlers per overlapping plugin run filesystem removal where applicable."
```

---

## Task 11: Generator respects `skipGeneratorOutputs`

**Files:**
- Modify: `src/core/generator.ts`
- Modify: `tests/unit/settings-merge.test.ts` (or `tests/unit/generator.test.ts` if a separate generator test file exists — check first)

- [ ] **Step 1: Write the failing test**

Add to `tests/unit/settings-merge.test.ts`:

```ts
describe('generator skipGeneratorOutputs', () => {
  let tempDir: string;
  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-skip-'));
  });
  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('skips husky pre-commit when override is set', async () => {
    const interview: InterviewResult = {
      ...defaultInterview,
      setupDomains: { claudeEnv: true, processDocs: false, cicd: true },
    };
    await generate(tempDir, makeAnalysis(tempDir), interview, {
      overrides: { skipGeneratorOutputs: ['husky-pre-commit'] },
    });
    let huskyExists = true;
    try {
      await readFile(join(tempDir, '.husky', 'pre-commit'), 'utf-8');
    } catch {
      huskyExists = false;
    }
    expect(huskyExists).toBe(false);
  });

  it('writes husky pre-commit when override is absent', async () => {
    const interview: InterviewResult = {
      ...defaultInterview,
      setupDomains: { claudeEnv: true, processDocs: false, cicd: true },
    };
    await generate(tempDir, makeAnalysis(tempDir), interview);
    const content = await readFile(join(tempDir, '.husky', 'pre-commit'), 'utf-8');
    expect(content.length).toBeGreaterThan(0);
  });
});
```

(Note: this requires `generate` to accept an optional fourth argument carrying overrides. If the existing `defaultInterview` fixture lacks the overrides field — it does — pass overrides as a separate param rather than threading via interview.)

- [ ] **Step 2: Run test to verify it fails**

Run: `npx vitest run tests/unit/settings-merge.test.ts -t "skipGeneratorOutputs"`
Expected: FAIL — `generate` only takes 3 args; husky is always written when `cicd` is true.

- [ ] **Step 3: Extend `generate` signature**

Edit `src/core/generator.ts`. Update the export:

```ts
import type { OverrideKey } from '../types/index.js';

interface GenerateOptions {
  overrides?: { skipGeneratorOutputs?: OverrideKey[] };
}

export async function generate(
  targetPath: string,
  analysis: AnalysisResult,
  interviewResult: InterviewResult,
  options: GenerateOptions = {},
): Promise<string[]> {
  const skip = new Set<OverrideKey>(options.overrides?.skipGeneratorOutputs ?? []);
  // ... existing setup
}
```

Then guard the four overlap emit branches with `skip.has(...)` checks. Each branch corresponds to one overlap key:

```ts
// CI/CD generation — guard the husky branch
if (interviewResult.setupDomains.cicd) {
  files.push(...generateCicd(targetPath, analysis, skip));
}
```

Update `generateCicd` to accept and respect `skip`:

```ts
function generateCicd(
  targetPath: string,
  analysis: AnalysisResult,
  skip: Set<OverrideKey>,
): FileOperation[] {
  const files: FileOperation[] = [];
  if (!skip.has('ci-workflow-vibe-coding-check')) {
    files.push({
      path: join(targetPath, '.github', 'workflows', 'vibe-coding-check.yml'),
      content: `...existing content...`,
      description: 'GitHub Actions workflow',
    });
  }
  if (!skip.has('husky-pre-commit')) {
    const lintCmd = getLintCommand(analysis.stack.languages);
    files.push({
      path: join(targetPath, '.husky', 'pre-commit'),
      content: `${lintCmd}\n`,
      description: 'Pre-commit hook',
    });
  }
  return files;
}
```

For `claude-deny-list` and `claude-md-roboco-block` — these are emitted by `generateClaudeSettings` and `appendRobocoContext` respectively. Update both to check `skip` and short-circuit when set.

In `generateClaudeSettings`:

```ts
function generateClaudeSettings(
  targetPath: string,
  analysis: AnalysisResult,
  skip: Set<OverrideKey>,
): FileOperation[] {
  const hooks = generateHooksForStack(analysis.stack.languages);
  const robocoDefaults: Record<string, unknown> = {
    permissions: skip.has('claude-deny-list')
      ? { allow: ['Read', 'Write', 'Edit', 'Glob', 'Grep', 'Bash(npm run *)', 'Bash(git status*)', 'Bash(git diff*)', 'Bash(git log*)'] }
      : {
          allow: [/* existing */],
          deny: [/* existing */],
        },
    ...(Object.keys(hooks).length > 0 ? { hooks } : {}),
  };
  // ... rest unchanged
}
```

In `appendRobocoContext`:

```ts
async function appendRobocoContext(
  targetPath: string,
  analysis: AnalysisResult,
  interviewResult: InterviewResult,
  skip: Set<OverrideKey>,
): Promise<void> {
  if (skip.has('claude-md-roboco-block')) return;
  // ... rest unchanged
}
```

Thread `skip` through all callsites in `generate()`.

- [ ] **Step 4: Update callers of `generate`**

Find every caller. Run: `grep -rn "generate(" src/ tests/ | grep -v "// "`

For each caller, pass overrides from `config.overrides` when available. Update `src/commands/init.ts`, `src/commands/install.ts`, `src/commands/update.ts`.

```ts
// install.ts / update.ts read existing config
await generate(targetPath, analysis, interview, { overrides: existingConfig.overrides });
```

- [ ] **Step 5: Run all tests**

Run: `npm test`
Expected: PASS — new skip tests green; all existing tests still pass.

- [ ] **Step 6: Commit**

```bash
git add src/core/generator.ts tests/unit/settings-merge.test.ts src/commands/
git commit -m "Honor skipGeneratorOutputs overrides in generator

generate() consults config.overrides and skips husky, ci-workflow,
claude-deny-list, or roboco-block emit branches when overridden."
```

---

## Task 12: README + verification gate documentation

**Files:**
- Modify: `README.md`
- Modify: `docs/superpowers/specs/2026-05-04-claude-toolbox-integration-design.md` (only if smoke test fails — see Step 4)

- [ ] **Step 1: Add toolbox row to "What Gets Generated" / "Optional" table in README.md**

Find the "Optional (selected during interview)" table in `README.md` and add:

```markdown
| claude-toolbox | Stack-aware bundle (next-action, todo, gh-issue-resolver, semgrep-review, sandbox-helpers, makefile-workflow + stack overlay) |
```

Add to the Commands table:

```markdown
| `roboco add toolbox` | Install full claude-toolbox bundle (stack-aware) |
| `roboco add toolbox:<plugin>` | Install a single claude-toolbox plugin (with overlap drop-replace prompt) |
```

- [ ] **Step 2: Run the verification smoke test**

Manual verification of project-level `enabledPlugins` honoring (per spec verification gate):

1. Create a clean tempdir: `mkdir /tmp/roboco-smoke && cd /tmp/roboco-smoke`
2. Build CLI: `npm run build` (in roboco-cli repo)
3. Run: `node /Users/jaehyun/go/src/github.com/roboco-io/roboco-cli/dist/index.js init --auto .`
4. Verify `.claude/settings.json` contains `extraKnownMarketplaces` and `enabledPlugins` keys.
5. Move `~/.claude/settings.json` aside temporarily: `mv ~/.claude/settings.json ~/.claude/settings.json.bak`
6. Launch Claude Code in `/tmp/roboco-smoke`: `claude`
7. Inside Claude Code, check active plugins: `/plugin list`
8. Confirm the toolbox plugins listed in the project settings are active.
9. Restore: `mv ~/.claude/settings.json.bak ~/.claude/settings.json`

Expected: project-scoped settings activate the bundle. Document the exact result (pass/fail/partial) in the PR description.

- [ ] **Step 3: If smoke test passes — proceed**

If verified, no further changes needed. The design as implemented is correct.

- [ ] **Step 4: If smoke test fails — document fallback**

If project-level `enabledPlugins` does NOT activate plugins for fresh users:

a. Edit `docs/superpowers/specs/2026-05-04-claude-toolbox-integration-design.md`. In the "Verification Gate" section, replace the "If verified" branch with the observed behavior, and the "If not" branch with the chosen mitigation.

b. Update `installToolbox` to log a teammate-facing instruction when project settings are written:

```ts
logger.info(
  `claude-toolbox: project settings recorded. Teammates run \`roboco install\` to enable plugins on their machine.`,
);
```

c. Ensure `roboco install` (`src/commands/install.ts`) calls `installToolbox(analysis)` when `config.installedTools.includes('toolbox')`. Add a test for this. (If this requires significant refactor, file as a follow-up issue and ship with manual install instructions.)

- [ ] **Step 5: Commit**

```bash
git add README.md docs/
git commit -m "Document claude-toolbox integration and verification result"
```

---

## Task 13: Final integration smoke + release prep

**Files:** None — verification only.

- [ ] **Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass (existing + new).

- [ ] **Step 2: Run typecheck**

Run: `npm run typecheck`
Expected: No errors.

- [ ] **Step 3: Run lint**

Run: `npm run lint`
Expected: No errors.

- [ ] **Step 4: Run build**

Run: `npm run build`
Expected: tsup completes successfully.

- [ ] **Step 5: End-to-end smoke**

Run a full `roboco init` cycle on a fresh tempdir (Python repo so toolbox shows core-only):

```bash
mkdir /tmp/roboco-e2e && cd /tmp/roboco-e2e
echo "print('hi')" > main.py
node /path/to/roboco-cli/dist/index.js init --auto .
```

Expected:
- `.claude/settings.json` written with `extraKnownMarketplaces` and `enabledPlugins`
- `.roboco/config.json` records `installedTools: [..., 'toolbox']` and `interview.tools.toolbox: true`
- Subprocess output shows marketplace add + per-plugin installs

Then:

```bash
node /path/to/roboco-cli/dist/index.js add toolbox:claude-md --path .
```

Decline the prompt; verify both husky and the no-cleanup-needed claude-md@claude-toolbox entry coexist (manual cleanup expected).

- [ ] **Step 6: Mark plan complete**

If all tasks pass, the plan is implemented. Open a PR referencing the spec and this plan.

---

## Self-Review

**Spec coverage:**

| Spec section | Implementing task |
|---|---|
| Architecture | Task 1 (types), Task 2 (bundles), Task 4 (settings), Task 5 (installer), Task 7 (interview), Task 8/9/10 (add) |
| Bundle Resolution | Task 2 |
| Settings.json Merge Schema | Task 4 |
| Install Flow during `roboco init` | Tasks 5, 6, 7 |
| `roboco add toolbox` and `:<plugin>` | Tasks 8, 9, 10 |
| Error Handling | Task 5 (timeout, marketplace failure, partial install), Task 10 (cleanup failure) |
| Testing | Each implementation task includes its TDD test pair |
| Verification Gate | Task 12 |
| `.roboco/config.json` overrides schema | Task 1, Task 10 |
| Phase 2 hand-off (skipGeneratorOutputs) | Task 11 |

No spec section is unaddressed.

**Placeholder scan:** No "TBD"/"TODO"/"implement later" entries. Each step shows the actual code to write or the exact command to run.

**Type consistency check:**
- `installToolbox(analysis)` — same signature in Task 5 (definition), Task 6 (router call), Task 8 (add command call). ✓
- `installSingleToolboxPlugin` — Task 9 returns `InstallResult`, Task 10 changes return shape to `{ result, configChanged }`. The Task 10 step explicitly updates the caller. ✓
- `mergeToolboxSettings(existing, bundle)` — same signature in Task 4 (definition), Task 5 (called via `writeProjectSettings`). ✓
- `RepoSignals.hasProto` — defined in Task 1, populated in Task 3, consumed in Tasks 2 and 7. ✓
- `OverrideKey` — defined in Task 1, used in Tasks 10, 11. Same union members in both. ✓
