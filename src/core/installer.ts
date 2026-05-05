import { join } from 'node:path';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { execa } from 'execa';
import type { AnalysisResult, ToolSelection } from '../types/index.js';
import { logger } from '../utils/logger.js';
import { resolveBundle, MARKETPLACE } from './toolbox-bundles.js';
import { mergeToolboxSettings } from './generator.js';

interface InstallResult {
  tool: string;
  success: boolean;
  message: string;
}

export async function installTools(tools: ToolSelection): Promise<InstallResult[]> {
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
