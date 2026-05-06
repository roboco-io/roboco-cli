import { resolve } from 'node:path';
import ora from 'ora';
import { fileExists, readJson } from '../utils/fs.js';
import { installTools, printInstallReport } from '../core/installer.js';
import { logger } from '../utils/logger.js';
import type { RobocoConfig } from '../types/index.js';

export async function installCommand(path: string | undefined): Promise<void> {
  const targetPath = resolve(path ?? '.');
  const configPath = resolve(targetPath, '.roboco', 'config.json');

  if (!(await fileExists(configPath))) {
    logger.error('This repository has not been initialized with ROBOCO.');
    logger.info('Run "roboco init" first to set up the vibe coding environment.');
    process.exitCode = 1;
    return;
  }

  const spinner = ora('Reading configuration...').start();
  const config = await readJson<RobocoConfig>(configPath);
  spinner.succeed('Configuration loaded');

  logger.info(`Version: ${config.version}`);
  logger.info(`Initialized: ${config.createdAt}`);

  const installSpinner = ora('Installing tools from configuration...').start();
  const results = await installTools(config.interview.tools, config.analysis);
  installSpinner.succeed('Installation complete');

  printInstallReport(results);

  logger.blank();
  logger.success('Environment ready! Start Claude Code: claude');
}
