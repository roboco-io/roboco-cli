import { resolve } from 'node:path';
import { fileExists, readJson } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type { RobocoConfig } from '../types/index.js';
import { analyze } from '../core/analyzer.js';

interface SyncOptions {
  check?: boolean;
  path?: string;
}

export async function syncCommand(options: SyncOptions): Promise<void> {
  const targetPath = resolve(options.path ?? '.');
  const configPath = resolve(targetPath, '.roboco', 'config.json');

  if (!(await fileExists(configPath))) {
    logger.error('No ROBOCO configuration found. Run "roboco init" first.');
    process.exitCode = 1;
    return;
  }

  const config = await readJson<RobocoConfig>(configPath);
  const currentAnalysis = await analyze(targetPath);

  logger.plain('ROBOCO Sync Check');
  logger.plain('═════════════════');
  logger.blank();

  const drifts: string[] = [];

  // Check stack drift
  const savedLangs = config.analysis.stack.languages.sort().join(',');
  const currentLangs = currentAnalysis.stack.languages.sort().join(',');
  if (savedLangs !== currentLangs) {
    drifts.push(`Stack changed: ${savedLangs || 'none'} → ${currentLangs || 'none'}`);
  }

  // Check framework drift
  const savedFw = config.analysis.stack.frameworks.sort().join(',');
  const currentFw = currentAnalysis.stack.frameworks.sort().join(',');
  if (savedFw !== currentFw) {
    drifts.push(`Frameworks changed: ${savedFw || 'none'} → ${currentFw || 'none'}`);
  }

  // Check missing critical files
  if (!currentAnalysis.existing.hasClaudeMd) {
    drifts.push('CLAUDE.md is missing');
  }
  if (!currentAnalysis.existing.hasClaude) {
    drifts.push('.claude/ directory is missing');
  }

  // Check git drift
  if (config.analysis.git.isRepo && !currentAnalysis.git.isRepo) {
    drifts.push('Git repository no longer detected');
  }

  if (drifts.length === 0) {
    logger.success('No configuration drift detected. Everything is in sync.');
  } else {
    for (const drift of drifts) {
      logger.warn(`Drift: ${drift}`);
    }
    logger.blank();

    if (options.check) {
      logger.error(`${drifts.length} drift(s) detected.`);
      process.exitCode = 1;
    } else {
      logger.info('Run "roboco update" to re-sync configuration.');
    }
  }
}
