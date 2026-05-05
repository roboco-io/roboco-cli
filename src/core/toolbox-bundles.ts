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
