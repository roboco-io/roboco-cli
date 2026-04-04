import { resolve, join } from 'node:path';
import { execa } from 'execa';
import { fileExists, readJson, readText } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type { RobocoConfig } from '../types/index.js';

interface ValidateOptions {
  fix?: boolean;
  path?: string;
}

interface CheckResult {
  label: string;
  ok: boolean;
  detail: string;
  fixable: boolean;
}

export async function validateCommand(options: ValidateOptions): Promise<void> {
  const targetPath = resolve(options.path ?? '.');
  const checks: CheckResult[] = [];

  // 1. CLAUDE.md exists and has content
  const claudeMdPath = join(targetPath, 'CLAUDE.md');
  if (await fileExists(claudeMdPath)) {
    const content = await readText(claudeMdPath);
    const hasContent =
      content.length > 50 && !content.includes('<!-- Describe your project here -->');
    checks.push({
      label: 'CLAUDE.md content',
      ok: hasContent,
      detail: hasContent
        ? `${content.split('\n').length} lines, customized`
        : 'Template only — needs customization',
      fixable: false,
    });
  } else {
    checks.push({ label: 'CLAUDE.md', ok: false, detail: 'Missing', fixable: true });
  }

  // 2. .claude/settings.json is valid JSON
  const settingsPath = join(targetPath, '.claude', 'settings.json');
  if (await fileExists(settingsPath)) {
    try {
      const content = await readText(settingsPath);
      JSON.parse(content);
      checks.push({
        label: '.claude/settings.json',
        ok: true,
        detail: 'Valid JSON',
        fixable: false,
      });
    } catch {
      checks.push({
        label: '.claude/settings.json',
        ok: false,
        detail: 'Invalid JSON',
        fixable: false,
      });
    }
  } else {
    checks.push({ label: '.claude/settings.json', ok: false, detail: 'Missing', fixable: true });
  }

  // 3. .roboco/config.json exists and is valid
  const configPath = join(targetPath, '.roboco', 'config.json');
  if (await fileExists(configPath)) {
    try {
      const config = await readJson<RobocoConfig>(configPath);
      checks.push({
        label: 'ROBOCO config',
        ok: !!config.version,
        detail: `v${config.version}, ${config.installedTools.length} tools`,
        fixable: false,
      });
    } catch {
      checks.push({ label: 'ROBOCO config', ok: false, detail: 'Corrupted', fixable: true });
    }
  } else {
    checks.push({
      label: 'ROBOCO config',
      ok: false,
      detail: 'Missing — run "roboco init"',
      fixable: false,
    });
  }

  // 4. Claude Code CLI accessible
  try {
    await execa('claude', ['--version'], { timeout: 5000 });
    checks.push({ label: 'Claude Code CLI', ok: true, detail: 'Accessible', fixable: false });
  } catch {
    checks.push({ label: 'Claude Code CLI', ok: false, detail: 'Not found', fixable: false });
  }

  // 5. Git hooks installed (if CI/CD was selected)
  if (await fileExists(configPath)) {
    try {
      const config = await readJson<RobocoConfig>(configPath);
      if (config.interview.setupDomains.cicd) {
        const hookPath = join(targetPath, '.husky', 'pre-commit');
        const hookExists = await fileExists(hookPath);
        checks.push({
          label: 'Pre-commit hook',
          ok: hookExists,
          detail: hookExists ? 'Installed' : 'Missing',
          fixable: true,
        });
      }
    } catch {
      /* skip */
    }
  }

  // Print results
  logger.plain('ROBOCO Validation');
  logger.plain('═════════════════');
  logger.blank();

  let passed = 0;
  let fixable = 0;
  for (const check of checks) {
    const icon = check.ok ? '✓' : '✗';
    const pad = ' '.repeat(24 - check.label.length);
    logger.plain(`  ${icon} ${check.label}${pad}${check.detail}`);
    if (check.ok) passed++;
    if (!check.ok && check.fixable) fixable++;
  }

  logger.blank();
  logger.plain(`${passed}/${checks.length} checks passed`);

  if (fixable > 0 && !options.fix) {
    logger.info(`${fixable} issue(s) can be fixed with "roboco validate --fix"`);
  }

  if (options.fix && fixable > 0) {
    logger.blank();
    logger.info('Fixing issues...');
    logger.info('Run "roboco init --auto" to regenerate missing files.');
  }

  if (passed < checks.length) {
    process.exitCode = 1;
  }
}
