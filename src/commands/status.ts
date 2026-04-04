import { resolve, join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { fileExists, readJson, readText } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { analyze } from '../core/analyzer.js';
import type { RobocoConfig } from '../types/index.js';

interface StatusOptions {
  format?: string;
}

export async function statusCommand(
  path: string | undefined,
  options: StatusOptions,
): Promise<void> {
  const targetPath = resolve(path ?? '.');
  const configPath = resolve(targetPath, '.roboco', 'config.json');
  const hasConfig = await fileExists(configPath);

  const analysis = await analyze(targetPath);
  const format = options.format ?? 'text';

  const items: Array<{ label: string; ok: boolean; detail: string }> = [];

  // CLAUDE.md
  if (analysis.existing.hasClaudeMd) {
    const content = await readText(join(targetPath, 'CLAUDE.md'));
    const lines = content.split('\n').length;
    items.push({ label: 'CLAUDE.md', ok: true, detail: `exists (${lines} lines)` });
  } else {
    items.push({ label: 'CLAUDE.md', ok: false, detail: 'not found' });
  }

  // .claude/
  if (analysis.existing.hasClaude) {
    const entries = await readdir(join(targetPath, '.claude'), { withFileTypes: true }).catch(
      (): never[] => [],
    );
    const dirs = entries
      .filter((e: { isDirectory(): boolean }) => e.isDirectory())
      .map((e: { name: string }) => e.name);
    items.push({
      label: '.claude/',
      ok: true,
      detail: `configured (${dirs.join(', ') || 'empty'})`,
    });
  } else {
    items.push({ label: '.claude/', ok: false, detail: 'not found' });
  }

  // OMC
  items.push({
    label: 'OMC',
    ok: analysis.existing.hasOmc,
    detail: analysis.existing.hasOmc ? 'installed' : 'not installed',
  });

  // .roboco config
  items.push({
    label: 'ROBOCO config',
    ok: hasConfig,
    detail: hasConfig ? 'initialized' : 'not initialized',
  });

  // OpenSpec
  items.push({
    label: 'OpenSpec',
    ok: analysis.existing.hasOpenSpec,
    detail: analysis.existing.hasOpenSpec ? 'configured' : 'not configured',
  });

  // Stack
  const stackLabel =
    [...analysis.stack.languages, ...analysis.stack.frameworks].join(', ') || 'Not detected';

  if (format === 'markdown') {
    printMarkdown(items, stackLabel, hasConfig ? configPath : null);
  } else {
    printText(items, stackLabel, hasConfig ? configPath : null);
  }
}

async function printText(
  items: Array<{ label: string; ok: boolean; detail: string }>,
  stack: string,
  configPath: string | null,
): Promise<void> {
  logger.plain('ROBOCO Status Report');
  logger.plain('═══════════════════');
  logger.blank();

  for (const item of items) {
    const icon = item.ok ? '✓' : '✗';
    const pad = ' '.repeat(20 - item.label.length);
    logger.plain(`  ${icon} ${item.label}${pad}${item.detail}`);
  }

  logger.blank();
  logger.plain(`  Stack: ${stack}`);

  if (configPath) {
    try {
      const config = await readJson<RobocoConfig>(configPath);
      logger.plain(`  Initialized: ${config.createdAt.split('T')[0]}`);
      logger.plain(`  Last updated: ${config.updatedAt.split('T')[0]}`);
    } catch {
      /* config may be corrupted */
    }
  }
}

function printMarkdown(
  items: Array<{ label: string; ok: boolean; detail: string }>,
  stack: string,
  _configPath: string | null,
): void {
  logger.plain('# ROBOCO Status Report\n');
  logger.plain('| Component | Status | Detail |');
  logger.plain('|-----------|--------|--------|');
  for (const item of items) {
    const status = item.ok ? '✓' : '✗';
    logger.plain(`| ${item.label} | ${status} | ${item.detail} |`);
  }
  logger.plain(`\n**Stack:** ${stack}`);
}
