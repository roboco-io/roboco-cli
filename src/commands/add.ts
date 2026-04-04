import { resolve } from 'node:path';
import ora from 'ora';
import { fileExists, readJson, writeJson } from '../utils/fs.js';
import { installTools } from '../core/installer.js';
import { logger } from '../utils/logger.js';
import type { RobocoConfig, ToolSelection } from '../types/index.js';

const KNOWN_TOOLS: Record<string, { key: keyof ToolSelection; description: string }> = {
  openspec: { key: 'openspec', description: 'Process documentation framework' },
  exa: { key: 'exaAi', description: 'Code/technical doc web search (Exa.ai MCP)' },
  perplexity: { key: 'perplexityAsk', description: 'General web search (Perplexity MCP)' },
  github: { key: 'githubMcp', description: 'Issue/PR management (GitHub MCP)' },
  context7: { key: 'context7', description: 'Up-to-date library docs (Context7 MCP)' },
  harness: { key: 'harness', description: 'Domain-specific agent team design' },
};

export async function addCommand(
  integration: string | undefined,
  options: { path?: string },
): Promise<void> {
  if (!integration) {
    logger.info('Available integrations:');
    for (const [name, { description }] of Object.entries(KNOWN_TOOLS)) {
      logger.plain(`  ${name.padEnd(14)} ${description}`);
    }
    logger.blank();
    logger.info('Usage: roboco add <integration> [--path <dir>]');
    return;
  }

  const tool = KNOWN_TOOLS[integration.toLowerCase()];
  if (!tool) {
    logger.error(`Unknown integration: "${integration}"`);
    logger.info(`Available: ${Object.keys(KNOWN_TOOLS).join(', ')}`);
    process.exitCode = 1;
    return;
  }

  const targetPath = resolve(options.path ?? '.');
  const configPath = resolve(targetPath, '.roboco', 'config.json');

  if (!(await fileExists(configPath))) {
    logger.error('This repository has not been initialized with ROBOCO.');
    logger.info('Run "roboco init" first.');
    process.exitCode = 1;
    return;
  }

  const config = await readJson<RobocoConfig>(configPath);

  if (config.interview.tools[tool.key]) {
    logger.warn(`${integration} is already enabled.`);
    return;
  }

  // Enable the tool
  (config.interview.tools as unknown as Record<string, boolean>)[tool.key] = true;

  const spinner = ora(`Installing ${integration}...`).start();
  const results = await installTools(config.interview.tools);
  const thisResult = results.find((r) => r.tool.toLowerCase().includes(integration.toLowerCase()));
  spinner.succeed(`${integration} installation complete`);

  if (thisResult) {
    if (thisResult.success) {
      logger.success(`${thisResult.tool}: ${thisResult.message}`);
    } else {
      logger.warn(`${thisResult.tool}: ${thisResult.message}`);
    }
  }

  // Update config
  config.updatedAt = new Date().toISOString();
  if (!config.installedTools.includes(integration)) {
    config.installedTools.push(integration);
  }
  await writeJson(configPath, config);
  logger.success(`Configuration updated.`);
}
