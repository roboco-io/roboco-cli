import { rm } from 'node:fs/promises';
import { join } from 'node:path';
import type { OverrideKey } from '../types/index.js';

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

export interface OverlapRemediation {
  description: string; // shown in the prompt
  overrideKey: OverrideKey; // recorded in .roboco/config.json
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
    cleanup: async () => {
      /* no-op; future-runs respect override */
    },
  },
  'claude-md': {
    description: '<roboco> block in CLAUDE.md',
    overrideKey: 'claude-md-roboco-block',
    cleanup: async () => {
      /* no-op; future-runs respect override */
    },
  },
};
