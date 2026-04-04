import { execa } from 'execa';
import { fileExists } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import { join } from 'node:path';
import { homedir } from 'node:os';

interface Check {
  label: string;
  ok: boolean;
  detail: string;
  fix?: string;
}

export async function doctorCommand(): Promise<void> {
  logger.plain('ROBOCO Doctor');
  logger.plain('═════════════');
  logger.blank();

  const checks: Check[] = [];

  // Node.js version
  const nodeVersion = process.version;
  const nodeMajor = parseInt(nodeVersion.slice(1).split('.')[0]!, 10);
  checks.push({
    label: 'Node.js version',
    ok: nodeMajor >= 20,
    detail: `${nodeVersion} ${nodeMajor >= 20 ? '(>=20 required)' : '(too old)'}`,
    fix: nodeMajor < 20 ? 'Upgrade Node.js to version 20 or later' : undefined,
  });

  // Claude Code CLI
  const claudeInstalled = await checkCommand('claude', ['--version']);
  checks.push({
    label: 'Claude Code CLI',
    ok: claudeInstalled.ok,
    detail: claudeInstalled.detail,
    fix: claudeInstalled.ok ? undefined : 'Install Claude Code: npm install -g @anthropic-ai/claude-code',
  });

  // Global config
  const globalConfigPath = join(homedir(), '.roboco', 'config.json');
  const hasGlobalConfig = await fileExists(globalConfigPath);
  checks.push({
    label: 'Global config',
    ok: true, // Not having global config is fine
    detail: hasGlobalConfig ? `${globalConfigPath}` : 'Not set (using defaults)',
  });

  // OMC
  const omcInstalled = await checkCommand('claude', ['plugin', 'list']);
  checks.push({
    label: 'OMC plugin',
    ok: omcInstalled.ok && omcInstalled.detail.includes('oh-my-claudecode'),
    detail: omcInstalled.ok && omcInstalled.detail.includes('oh-my-claudecode')
      ? 'installed'
      : 'not found',
    fix: 'Install: claude plugin install omc@oh-my-claudecode',
  });

  // Print results
  let passed = 0;
  for (const check of checks) {
    const icon = check.ok ? '✓' : '✗';
    const pad = ' '.repeat(22 - check.label.length);
    logger.plain(`  ${icon} ${check.label}${pad}${check.detail}`);
    if (!check.ok && check.fix) {
      logger.plain(`    → ${check.fix}`);
    }
    if (check.ok) passed++;
  }

  logger.blank();
  logger.plain(`${passed}/${checks.length} checks passed`);

  if (passed < checks.length) {
    process.exitCode = 1;
  }
}

async function checkCommand(cmd: string, args: string[]): Promise<{ ok: boolean; detail: string }> {
  try {
    const { stdout } = await execa(cmd, args, { timeout: 10000 });
    return { ok: true, detail: stdout.trim().split('\n')[0] ?? 'ok' };
  } catch {
    return { ok: false, detail: 'not found' };
  }
}
