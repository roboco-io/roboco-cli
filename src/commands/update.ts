import { resolve } from 'node:path';
import ora from 'ora';
import { analyze } from '../core/analyzer.js';
import { interview } from '../core/interviewer.js';
import { generate } from '../core/generator.js';
import { installTools, printInstallReport } from '../core/installer.js';
import { fileExists, readJson, writeJson } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type { RobocoConfig } from '../types/index.js';

interface UpdateOptions {
  auto?: boolean;
}

export async function updateCommand(
  path: string | undefined,
  options: UpdateOptions,
): Promise<void> {
  const targetPath = resolve(path ?? '.');
  const configPath = resolve(targetPath, '.roboco', 'config.json');

  if (!(await fileExists(configPath))) {
    logger.warn('No existing ROBOCO configuration found. Running init instead.');
    const { initCommand } = await import('./init.js');
    await initCommand(path, { auto: options.auto });
    return;
  }

  const spinner = ora('Re-analyzing repository...').start();
  const analysis = await analyze(targetPath);
  spinner.succeed('Repository re-analyzed');

  const interviewResult = await interview(analysis, { auto: options.auto ?? false });

  const existing = await readJson<RobocoConfig>(configPath);

  const genSpinner = ora('Updating configuration...').start();
  const created = await generate(targetPath, analysis, interviewResult, {
    overrides: existing.overrides,
  });
  genSpinner.succeed(`Updated ${created.length} files`);

  // Update config
  existing.updatedAt = new Date().toISOString();
  existing.analysis = analysis;
  existing.interview = interviewResult;
  await writeJson(configPath, existing);

  const installSpinner = ora('Updating tools...').start();
  const results = await installTools(interviewResult.tools, analysis);
  installSpinner.succeed('Tools updated');
  printInstallReport(results);

  logger.blank();
  logger.success('ROBOCO configuration updated!');
}
