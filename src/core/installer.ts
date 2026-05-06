import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execa } from 'execa';
import type { AnalysisResult, RobocoConfig, ToolSelection } from '../types/index.js';
import { logger } from '../utils/logger.js';
import {
  resolveBundle,
  MARKETPLACE,
  KNOWN_PLUGINS,
  OVERLAPPING_PLUGINS,
  OVERLAP_REMEDIATION,
} from './toolbox-bundles.js';
import { confirm } from '../utils/prompt.js';
import { mergeToolboxSettings } from './generator.js';

export interface InstallResult {
  tool: string;
  success: boolean;
  message: string;
}

export async function installTools(
  tools: ToolSelection,
  analysis: AnalysisResult,
): Promise<InstallResult[]> {
  const results: InstallResult[] = [];

  // OMC (required)
  results.push(await installOMC());

  // Optional MCP servers
  if (tools.exaAi) results.push(await installMCP('exa', 'npx -y exa-mcp-server', 'EXA_API_KEY'));
  if (tools.perplexityAsk)
    results.push(
      await installMCP(
        'perplexity-ask',
        'npx -y @anthropic-ai/perplexity-ask',
        'PERPLEXITY_API_KEY',
      ),
    );
  if (tools.githubMcp)
    results.push(
      await installMCP('github', 'npx -y @modelcontextprotocol/server-github', 'GITHUB_TOKEN'),
    );
  if (tools.context7)
    results.push(await installMCPSimple('context7', 'npx -y @upstash/context7-mcp@latest'));

  // OpenSpec
  if (tools.openspec) results.push(await installOpenSpec());

  // Harness
  if (tools.harness) results.push(await installHarness());

  // Toolbox
  if (tools.toolbox) results.push(await installToolbox(analysis));

  return results;
}

async function installOMC(): Promise<InstallResult> {
  try {
    await execa('claude', ['plugin', 'install', 'omc@oh-my-claudecode'], { timeout: 60000 });
    return { tool: 'oh-my-claudecode', success: true, message: 'Installed via plugin' };
  } catch {
    logger.warn(
      'OMC plugin install failed. You can install it manually: claude plugin install omc@oh-my-claudecode',
    );
    return {
      tool: 'oh-my-claudecode',
      success: false,
      message: 'Install failed — install manually',
    };
  }
}

async function installMCP(name: string, command: string, envVar: string): Promise<InstallResult> {
  const apiKey = process.env[envVar];
  if (!apiKey) {
    logger.warn(`${name}: skipped (${envVar} not set)`);
    return { tool: name, success: false, message: `${envVar} not set — skipped` };
  }

  try {
    const args = ['mcp', 'add', '-e', `${envVar}=${apiKey}`, name, '--', ...command.split(' ')];
    await execa('claude', args, { timeout: 30000 });
    return { tool: name, success: true, message: 'MCP server configured' };
  } catch {
    return { tool: name, success: false, message: 'Configuration failed' };
  }
}

async function installMCPSimple(name: string, command: string): Promise<InstallResult> {
  try {
    const args = ['mcp', 'add', name, '--', ...command.split(' ')];
    await execa('claude', args, { timeout: 30000 });
    return { tool: name, success: true, message: 'MCP server configured' };
  } catch {
    return { tool: name, success: false, message: 'Configuration failed' };
  }
}

async function installOpenSpec(): Promise<InstallResult> {
  // OpenSpec is typically a set of config files, not an npm package
  return { tool: 'openspec', success: true, message: 'Config generated (see openspec/)' };
}

async function installHarness(): Promise<InstallResult> {
  try {
    await execa('claude', ['plugin', 'install', 'harness@harness'], { timeout: 60000 });
    return { tool: 'harness', success: true, message: 'Installed via plugin' };
  } catch {
    logger.warn(
      'Harness plugin install failed. Install manually: claude plugin install harness@harness',
    );
    return { tool: 'harness', success: false, message: 'Install failed — install manually' };
  }
}

export function printInstallReport(results: InstallResult[]): void {
  logger.blank();
  logger.info('Tool installation results:');
  for (const r of results) {
    if (r.success) {
      logger.success(`  ${r.tool}: ${r.message}`);
    } else {
      logger.warn(`  ${r.tool}: ${r.message}`);
    }
  }
}

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

export async function installSingleToolboxPlugin(
  name: string,
  targetPath: string,
  config: RobocoConfig,
): Promise<{ result: InstallResult; configChanged: boolean }> {
  if (!KNOWN_PLUGINS.has(name)) {
    return {
      result: {
        tool: `claude-toolbox:${name}`,
        success: false,
        message: `Unknown plugin: ${name}`,
      },
      configChanged: false,
    };
  }

  let configChanged = false;
  let acceptedOverlap = false;
  const remediation = OVERLAPPING_PLUGINS.has(name) ? OVERLAP_REMEDIATION[name] : undefined;

  if (OVERLAPPING_PLUGINS.has(name) && !remediation) {
    return {
      result: {
        tool: `claude-toolbox:${name}`,
        success: false,
        message: `No remediation for overlap: ${name}`,
      },
      configChanged: false,
    };
  }

  if (remediation) {
    acceptedOverlap = await confirm(
      `This replaces ROBOCO's ${remediation.description}. Drop ROBOCO's version?`,
      false,
    );
    if (acceptedOverlap) {
      try {
        await remediation.cleanup(targetPath);
      } catch {
        logger.warn(`Cleanup of ${remediation.description} failed — continuing`);
      }
    } else {
      logger.warn('Both will coexist — manual cleanup may be needed.');
    }
  }

  // writeProjectSettings must succeed before we mutate in-memory config —
  // prevents half-migrated state on filesystem errors (EROFS, EACCES).
  await writeProjectSettings(targetPath, [name]);

  // Override recording: only after writeProjectSettings succeeds, only if user accepted.
  if (remediation && acceptedOverlap) {
    config.overrides ??= {};
    config.overrides.skipGeneratorOutputs ??= [];
    if (!config.overrides.skipGeneratorOutputs.includes(remediation.overrideKey)) {
      config.overrides.skipGeneratorOutputs.push(remediation.overrideKey);
    }
    configChanged = true;

    // Surface deferred-cleanup intent to the user for no-op remediation entries.
    if (
      remediation.overrideKey === 'claude-deny-list' ||
      remediation.overrideKey === 'claude-md-roboco-block'
    ) {
      logger.info(
        `Recorded override; existing ${remediation.description} will be replaced on next "roboco update".`,
      );
    }
  }

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
