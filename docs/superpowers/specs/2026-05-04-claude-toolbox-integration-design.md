# claude-toolbox Integration Design

**Date:** 2026-05-04
**Status:** Spec — pending implementation plan
**Scope:** Phase 1 — additive expansion. Phase 2 (replacement of overlapping ROBOCO outputs) is out of scope for this spec.

## Goal

Make `jaeyeom/claude-toolbox` plugins available through `roboco init` and `roboco add`, with stack-aware bundle selection and team-consistent installation.

## Decisions

| Axis | Choice |
|---|---|
| Direction | Additive expansion. Replacement of overlapping ROBOCO outputs deferred to Phase 2. |
| Granularity | Curated bundles, not per-plugin entries. |
| Install mechanism | Project-scoped `.claude/settings.json` (team consistency) + `claude plugin install` subprocess on initiating machine (immediate availability). |
| Bundle shape | Stack-aware: `CORE_BUNDLE` + `STACK_OVERLAYS` + `SIGNAL_OVERLAYS`. |
| Surfacing | Both interview-time (`roboco init`) and post-init (`roboco add`). |
| Overlap handling | Skip overlapping plugins from default bundle. Opt-in only via `roboco add toolbox:<plugin>` with drop-replace prompt. |

## Non-Goals

- Replacing ROBOCO's existing CLAUDE.md generation, husky hooks, deny list, or CI workflow with toolbox equivalents (Phase 2).
- Per-plugin granularity in the default bundle. Users who want a single plugin use `roboco add toolbox:<plugin>`.
- Installing every toolbox plugin. Niche plugins (`apply-figma-make`, `cloudflare-macos-fix`, `create-lang-dev-skill`, Jira plugins) are not in defaults.

## Architecture

Three new code units; no new architectural concepts. Matches the existing `installer.ts` + `KNOWN_TOOLS` + interview pattern that OMC and MCP servers already use.

```
src/
  core/
    toolbox-bundles.ts    # NEW: bundle definitions, resolution, overlap remediation
    installer.ts          # +installToolbox(), +installSingleToolboxPlugin()
    generator.ts          # +mergeToolboxSettings() into deepMergeSettings
  commands/
    add.ts                # +"toolbox" entry, +"toolbox:<plugin>" parsing
  types/
    index.ts              # +toolbox flag in ToolSelection
```

## Bundle Resolution

Pure function in `core/toolbox-bundles.ts`:

```ts
export const MARKETPLACE = {
  name: 'claude-toolbox',
  source: { source: 'github', repo: 'jaeyeom/claude-toolbox' },
};

export const CORE_BUNDLE = [
  'next-action',
  'todo',
  'gh-issue-resolver',
  'semgrep-review',
  'sandbox-helpers',
  'makefile-workflow',
];

export const STACK_OVERLAYS: Record<string, string[]> = {
  Go:         ['go-dev'],
  TypeScript: ['biome-vcs-integration'],
  JavaScript: ['biome-vcs-integration'],
  // Python, Rust, Java: empty until toolbox ships *-dev plugins
};

export const SIGNAL_OVERLAYS: Record<string, string[]> = {
  hasProto: ['protobuf-dev'],
};

export const OVERLAPPING_PLUGINS = new Set([
  'claude-md',
  'gabyx-githooks-setup',
  'git-guardrails',
  'ci-workflow',
]);

export function resolveBundle(
  languages: string[],
  signals: { hasProto?: boolean },
): string[] {
  const stackOverlay = languages.flatMap((l) => STACK_OVERLAYS[l] ?? []);
  const signalOverlay = Object.entries(signals)
    .filter(([, on]) => on)
    .flatMap(([key]) => SIGNAL_OVERLAYS[key] ?? []);
  return [...new Set([...CORE_BUNDLE, ...stackOverlay, ...signalOverlay])]
    .filter((p) => !OVERLAPPING_PLUGINS.has(p));
}
```

Resolved examples:

| Stack / signal | Plugins installed |
|---|---|
| TypeScript | core 6 + `biome-vcs-integration` |
| Go | core 6 + `go-dev` |
| TypeScript + `.proto` files | core 6 + `biome-vcs-integration` + `protobuf-dev` |
| Python / Rust / Java | core 6 |

**Note:** Until the toolbox ships `*-dev` plugins for non-Go/TS stacks, those stacks get the same 6 core plugins. The stack-aware structure exists to absorb future toolbox additions without code changes to the bundle shape.

## Settings.json Merge Schema

Two keys land in the project's `.claude/settings.json`:

```json
{
  "extraKnownMarketplaces": {
    "claude-toolbox": {
      "source": { "source": "github", "repo": "jaeyeom/claude-toolbox" }
    }
  },
  "enabledPlugins": {
    "next-action@claude-toolbox": true,
    "todo@claude-toolbox": true,
    "gh-issue-resolver@claude-toolbox": true,
    "semgrep-review@claude-toolbox": true,
    "sandbox-helpers@claude-toolbox": true,
    "makefile-workflow@claude-toolbox": true
  }
}
```

`generator.ts:172` `deepMergeSettings` currently special-cases only `permissions` (union arrays). Extend with two keys:

| Key | Merge rule |
|---|---|
| `extraKnownMarketplaces` | Add `claude-toolbox` entry if absent. If present with matching `source`, no-op. If present with **different** source, log warning and skip (user has a custom marketplace fork). |
| `enabledPlugins` | For each `X@claude-toolbox`: set `true` if absent, no-op if already `true`, **respect explicit `false`** (never overwrite a user disable). |

```ts
function mergeToolboxSettings(
  existing: Record<string, unknown>,
  bundle: string[],
): Record<string, unknown> {
  const result = { ...existing };

  const marketplaces = (result.extraKnownMarketplaces ?? {}) as Record<string, unknown>;
  if (!marketplaces['claude-toolbox']) {
    marketplaces['claude-toolbox'] = {
      source: { source: 'github', repo: 'jaeyeom/claude-toolbox' },
    };
  }
  result.extraKnownMarketplaces = marketplaces;

  const plugins = (result.enabledPlugins ?? {}) as Record<string, boolean>;
  for (const name of bundle) {
    const key = `${name}@claude-toolbox`;
    if (plugins[key] !== false) plugins[key] = true;
  }
  result.enabledPlugins = plugins;

  return result;
}
```

## Install Flow during `roboco init`

New `ToolSelection` field:

```ts
// types/index.ts
export interface ToolSelection {
  // ... existing
  toolbox: boolean;
}
```

Interview adds one question:

> "Install the claude-toolbox bundle? Adds task workflow (next-action, todo, gh-issue-resolver), security review (semgrep-review), and check orchestration (makefile-workflow).
> Detected stack: <stack> → also installs `<overlay>`. [Y/n]"

Default: `yes`. The detected-stack line is omitted when no overlay applies.

`installToolbox(analysis)` runs alongside the existing `installTools()`:

```
installToolbox(analysis):
  1. bundle = resolveBundle(analysis.stack.languages, analysis.signals)
  2. mergeToolboxSettings → write project .claude/settings.json
  3. subprocess: claude plugin marketplace add jaeyeom/claude-toolbox
     ↳ on failure: warn, skip step 4, return InstallResult{success: false}
  4. for each plugin in bundle:
       subprocess: claude plugin install <plugin>@claude-toolbox
       ↳ on failure: warn for that plugin, continue with rest
  5. return InstallResult{
       tool: 'claude-toolbox',
       success: marketplaceOk && atLeastOnePluginInstalled,
       message: "Installed N/M plugins. Teammates: run `roboco install` to enable."
     }
```

**Order matters:** settings.json edit happens *first* — it is the source of truth for team consistency and survives subprocess failure. Subprocess install is a convenience for the initiating user (skip Claude Code restart). If subprocess fails entirely, the project settings.json still records intent and `roboco install` can retry.

## `roboco add toolbox` and `roboco add toolbox:<plugin>`

`add.ts:8` `KNOWN_TOOLS` gets one entry:

```ts
toolbox: { key: 'toolbox', description: 'claude-toolbox bundle (stack-aware)' }
```

Two parsing paths in `addCommand`:

```
roboco add toolbox          → installToolbox(analysis)               # same as init
roboco add toolbox:<plugin> → installSingleToolboxPlugin(<plugin>)   # opt-in single
```

`installSingleToolboxPlugin` enables Phase 2:

```
installSingleToolboxPlugin(name):
  1. if name not in known toolbox catalog → error
  2. if name in OVERLAPPING_PLUGINS:
       prompt: "This replaces ROBOCO's <X>. Drop ROBOCO's version? [y/N]"
       on yes:
         run OVERLAP_REMEDIATION[name].cleanup()
         record override in .roboco/config.json overrides[] (future generator runs skip it)
       on no:
         warn: "Both will coexist — manual cleanup may be needed"
  3. read existing .claude/settings.json; mergeToolboxSettings(existing, [name]) → write back
  4. subprocess: claude plugin install <name>@claude-toolbox
```

Overlap remediation registry in `core/toolbox-bundles.ts`:

```ts
export const OVERLAP_REMEDIATION: Record<string, { description: string; cleanup: () => Promise<void> }> = {
  'gabyx-githooks-setup': { description: '.husky/pre-commit',                          cleanup: removeHuskyHook },
  'ci-workflow':          { description: '.github/workflows/vibe-coding-check.yml',    cleanup: removeCiWorkflow },
  'git-guardrails':       { description: '.claude/settings.json deny entries',         cleanup: removeRobocoDenyList },
  'claude-md':            { description: '<roboco> block in CLAUDE.md',                cleanup: removeRobocoBlock },
};
```

Phase 2 work later: when an overlap drop becomes the default, that lives in updating `generator.ts` to skip the corresponding output when `.roboco/config.json` records the override — this spec only defines the override-recording mechanism, not the swap.

`.roboco/config.json` override schema:

```ts
// types/index.ts — extend RobocoConfig
export interface RobocoConfig {
  // ... existing
  overrides?: {
    /** Generator outputs the user has opted out of in favor of toolbox plugins. */
    skipGeneratorOutputs?: Array<
      | 'husky-pre-commit'
      | 'ci-workflow-vibe-coding-check'
      | 'claude-deny-list'
      | 'claude-md-roboco-block'
    >;
  };
}
```

`OVERLAP_REMEDIATION[name]` declares which `skipGeneratorOutputs` token to add when the user accepts the drop. `generator.ts` consults `config.overrides?.skipGeneratorOutputs` and skips matching emit branches on subsequent runs.

## Error Handling

| Source | Handling |
|---|---|
| `claude` CLI absent | Same as `installOMC` — warn with manual install command, return `success: false`, do not abort `roboco init` |
| `claude plugin install` timeout (60s/plugin) | Continue with rest of bundle |
| Marketplace add fails | Skip plugin installs (they would all fail), settings.json still written |
| Settings.json write fails | Abort `installToolbox` — settings is source of truth, silent corruption is worse than visible failure |
| Overlap drop-replace cleanup fails | Log warning, leave settings.json change intact, surface in final report |

User-facing messages follow CLAUDE.md's "friendly with actionable next steps" rule:

```
✗ claude-toolbox: marketplace add failed
  → Run manually: claude plugin marketplace add jaeyeom/claude-toolbox
  → Then re-run: roboco add toolbox
```

`InstallResult` shape unchanged — no new error type required.

## Testing

Tests mirror `src/` structure per CLAUDE.md.

| Test file | Coverage |
|---|---|
| `tests/core/toolbox-bundles.test.ts` (new) | `resolveBundle` pure function — fixture inputs (TS / Go / Python / multi-stack / hasProto), assert exact plugin lists, assert overlap exclusion |
| `tests/core/installer.test.ts` (extend) | `installToolbox` — mock `execa`; assert correct `claude plugin install` invocations per resolved bundle; assert settings.json write content; assert partial-failure behavior (marketplace ok + one plugin fails) |
| `tests/commands/add.test.ts` (extend) | `roboco add toolbox` invokes bundle installer; `roboco add toolbox:<plugin>` parses and dispatches single-plugin path; overlap prompt path with mocked user input (yes runs cleanup, no warns) |

Existing framework: vitest + execa mocks. No new framework or fixture style.

## Verification Gate

The install mechanism (project-scoped `.claude/settings.json` + subprocess) assumes Claude Code honors project-level `enabledPlugins` and auto-fetches the marketplace on first run for teammates who clone the repo. **This must be verified before implementation lands.**

Smoke test:

1. Write a minimal project `.claude/settings.json` containing only `extraKnownMarketplaces` and `enabledPlugins`.
2. Launch Claude Code in a clean home directory (no `~/.claude/settings.json` entries for claude-toolbox).
3. Confirm the marketplace is fetched and the listed plugins activate.

**If verified:** proceed with the design as specified.
**If not:** fall back to subprocess-only install (option A from the install-mechanism question). Document teammate workflow in `.roboco/config.json`-driven `roboco install` flow: `install` runs `claude plugin install` for every plugin recorded in `installedTools`. Update this spec to reflect the fallback before implementation.

This gate must be a task in the implementation plan.

## Out of Scope (Phase 2)

These are documented here so future-us remembers what *not* to bundle into the Phase 1 implementation:

- Switching ROBOCO's husky pre-commit to `gabyx-githooks-setup` by default.
- Switching ROBOCO's `.github/workflows/vibe-coding-check.yml` to `ci-workflow` by default.
- Auto-invoking the `claude-md` skill after `claude /init`.
- Adding `git-guardrails` deny entries to ROBOCO's default deny list.
- Per-overlap interview questions ("ROBOCO or toolbox for hooks?").

Each Phase 2 swap is its own decision and its own PR.
