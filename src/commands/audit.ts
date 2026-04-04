import { resolve, join } from 'node:path';
import { readdir } from 'node:fs/promises';
import { analyze } from '../core/analyzer.js';
import { fileExists, readText, readJson } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type { RobocoConfig } from '../types/index.js';

interface AuditCategory {
  name: string;
  score: number;
  maxScore: number;
  findings: string[];
  suggestions: string[];
}

interface AuditOptions {
  format?: string;
  path?: string;
}

export async function auditCommand(options: AuditOptions): Promise<void> {
  const targetPath = resolve(options.path ?? '.');
  const analysis = await analyze(targetPath);
  const categories: AuditCategory[] = [];

  // 1. Claude Code Environment (30 points)
  categories.push(await auditClaudeEnv(targetPath, analysis));

  // 2. Process & Documentation (20 points)
  categories.push(await auditProcessDocs(targetPath));

  // 3. Quality Gates (20 points)
  categories.push(await auditQualityGates(targetPath, analysis));

  // 4. Tool Integration (15 points)
  categories.push(await auditToolIntegration(targetPath));

  // 5. Team Consistency (15 points)
  categories.push(await auditTeamConsistency(targetPath, analysis));

  const totalScore = categories.reduce((sum, c) => sum + c.score, 0);
  const maxScore = categories.reduce((sum, c) => sum + c.maxScore, 0);
  const percentage = Math.round((totalScore / maxScore) * 100);
  const grade = getGrade(percentage);

  if (options.format === 'markdown') {
    printMarkdown(categories, totalScore, maxScore, percentage, grade);
  } else {
    printText(categories, totalScore, maxScore, percentage, grade);
  }
}

async function auditClaudeEnv(
  targetPath: string,
  analysis: ReturnType<typeof analyze> extends Promise<infer T> ? T : never,
): Promise<AuditCategory> {
  const cat: AuditCategory = {
    name: 'Claude Code Environment',
    score: 0,
    maxScore: 30,
    findings: [],
    suggestions: [],
  };

  // CLAUDE.md exists and is customized (10 points)
  const claudeMdPath = join(targetPath, 'CLAUDE.md');
  if (await fileExists(claudeMdPath)) {
    const content = await readText(claudeMdPath);
    const lines = content.split('\n').length;
    const isCustomized = !content.includes('<!-- Describe your project here -->');
    const hasSections = ['## ', '```'].filter((s) => content.includes(s)).length;

    if (isCustomized && lines > 30 && hasSections >= 2) {
      cat.score += 10;
      cat.findings.push(`CLAUDE.md: ${lines} lines, customized with code blocks`);
    } else if (isCustomized) {
      cat.score += 6;
      cat.findings.push(`CLAUDE.md: ${lines} lines, customized but could be richer`);
      cat.suggestions.push(
        'Add code examples, build commands, and coding conventions to CLAUDE.md',
      );
    } else {
      cat.score += 2;
      cat.findings.push('CLAUDE.md exists but is still template');
      cat.suggestions.push('Customize CLAUDE.md with project-specific context');
    }
  } else {
    cat.findings.push('CLAUDE.md missing');
    cat.suggestions.push('Run "roboco init" to generate CLAUDE.md');
  }

  // .claude/settings.json with hooks (10 points)
  const settingsPath = join(targetPath, '.claude', 'settings.json');
  if (await fileExists(settingsPath)) {
    try {
      const settings = JSON.parse(await readText(settingsPath));
      cat.score += 5;
      cat.findings.push('.claude/settings.json: valid');
      if (settings.hooks && Object.keys(settings.hooks).length > 0) {
        cat.score += 5;
        cat.findings.push('Claude Code Hooks: configured');
      } else {
        cat.suggestions.push('Add Claude Code Hooks for auto-formatting on file changes');
      }
    } catch {
      cat.findings.push('.claude/settings.json: invalid JSON');
      cat.suggestions.push('Fix or regenerate .claude/settings.json');
    }
  } else {
    cat.findings.push('.claude/ settings missing');
    cat.suggestions.push('Run "roboco init" to generate .claude/ settings');
  }

  // Skills or commands (10 points)
  const skillsDir = join(targetPath, '.claude', 'skills');
  const commandsDir = join(targetPath, '.claude', 'commands');
  let hasSkills = false;
  let hasCommands = false;
  try {
    const skills = await readdir(skillsDir);
    hasSkills = skills.length > 0;
  } catch {
    /* ignore */
  }
  try {
    const commands = await readdir(commandsDir);
    hasCommands = commands.length > 0;
  } catch {
    /* ignore */
  }

  if (hasSkills && hasCommands) {
    cat.score += 10;
    cat.findings.push('Skills and commands: configured');
  } else if (hasSkills || hasCommands) {
    cat.score += 5;
    cat.findings.push(`${hasSkills ? 'Skills' : 'Commands'}: configured`);
    cat.suggestions.push(
      `Add ${hasSkills ? 'custom commands' : 'project skills'} for domain-specific workflows`,
    );
  } else {
    cat.suggestions.push(
      'Add .claude/skills/ or .claude/commands/ for project-specific AI workflows',
    );
  }

  return cat;
}

async function auditProcessDocs(targetPath: string): Promise<AuditCategory> {
  const cat: AuditCategory = {
    name: 'Process & Documentation',
    score: 0,
    maxScore: 20,
    findings: [],
    suggestions: [],
  };

  // Vibe coding process docs (10 points)
  const stages = [
    '01-intent.md',
    '02-requirements.md',
    '03-research.md',
    '04-plan.md',
    '05-implement.md',
  ];
  let stageCount = 0;
  for (const stage of stages) {
    if (await fileExists(join(targetPath, 'docs', 'vibe-coding', stage))) {
      stageCount++;
    }
  }
  if (stageCount === 5) {
    cat.score += 10;
    cat.findings.push('All 5 vibe coding stage templates present');
  } else if (stageCount > 0) {
    cat.score += Math.round((stageCount / 5) * 10);
    cat.findings.push(`${stageCount}/5 vibe coding stage templates`);
    cat.suggestions.push('Complete all 5 stage templates for full process coverage');
  } else {
    cat.suggestions.push(
      'Add vibe coding process templates: roboco init with process docs enabled',
    );
  }

  // OpenSpec (5 points)
  if (await fileExists(join(targetPath, 'openspec', 'config.yaml'))) {
    cat.score += 5;
    cat.findings.push('OpenSpec: configured');
  } else {
    cat.suggestions.push('Consider adding OpenSpec for structured spec-driven development');
  }

  // README (5 points)
  if (await fileExists(join(targetPath, 'README.md'))) {
    const content = await readText(join(targetPath, 'README.md'));
    if (content.length > 200) {
      cat.score += 5;
      cat.findings.push('README.md: present and substantive');
    } else {
      cat.score += 2;
      cat.suggestions.push('Expand README.md with setup instructions and usage examples');
    }
  } else {
    cat.suggestions.push('Add a README.md');
  }

  return cat;
}

async function auditQualityGates(
  targetPath: string,
  analysis: ReturnType<typeof analyze> extends Promise<infer T> ? T : never,
): Promise<AuditCategory> {
  const cat: AuditCategory = {
    name: 'Quality Gates',
    score: 0,
    maxScore: 20,
    findings: [],
    suggestions: [],
  };

  // CI/CD pipeline (8 points)
  const ciPath = join(targetPath, '.github', 'workflows');
  try {
    const workflows = await readdir(ciPath);
    if (workflows.length > 0) {
      cat.score += 8;
      cat.findings.push(`GitHub Actions: ${workflows.length} workflow(s)`);
    }
  } catch {
    cat.suggestions.push('Add GitHub Actions CI pipeline');
  }

  // Pre-commit hooks (6 points)
  if (await fileExists(join(targetPath, '.husky', 'pre-commit'))) {
    cat.score += 6;
    cat.findings.push('Pre-commit hooks: installed');
  } else {
    cat.suggestions.push('Add pre-commit hooks via husky for local quality enforcement');
  }

  // Linting config (3 points)
  const hasLint =
    (await fileExists(join(targetPath, 'eslint.config.js'))) ||
    (await fileExists(join(targetPath, '.eslintrc.json'))) ||
    (await fileExists(join(targetPath, 'pyproject.toml')));
  if (hasLint) {
    cat.score += 3;
    cat.findings.push('Linting: configured');
  } else {
    cat.suggestions.push('Add linting configuration');
  }

  // Tests (3 points)
  if (analysis.structure.testDir) {
    cat.score += 3;
    cat.findings.push(`Tests: ${analysis.structure.testDir}/ directory found`);
  } else {
    cat.suggestions.push('Add tests directory');
  }

  return cat;
}

async function auditToolIntegration(targetPath: string): Promise<AuditCategory> {
  const cat: AuditCategory = {
    name: 'Tool Integration',
    score: 0,
    maxScore: 15,
    findings: [],
    suggestions: [],
  };

  const configPath = join(targetPath, '.roboco', 'config.json');
  if (!(await fileExists(configPath))) {
    cat.suggestions.push('Initialize ROBOCO to track tool integrations');
    return cat;
  }

  const config = await readJson<RobocoConfig>(configPath);
  const tools = config.interview.tools;

  // OMC (5 points)
  if (tools.omc) {
    cat.score += 5;
    cat.findings.push('OMC: enabled');
  }

  // MCP servers (5 points — 1 per server, max 5)
  const mcpTools = [tools.exaAi, tools.perplexityAsk, tools.githubMcp, tools.context7].filter(
    Boolean,
  );
  const mcpScore = Math.min(mcpTools.length * 1.25, 5);
  cat.score += Math.round(mcpScore);
  if (mcpTools.length > 0) {
    cat.findings.push(`MCP servers: ${mcpTools.length} configured`);
  } else {
    cat.suggestions.push('Add MCP servers (exa, context7, github) for enhanced AI capabilities');
  }

  // Harness / OpenSpec (5 points)
  const extras = [tools.harness, tools.openspec].filter(Boolean);
  cat.score += Math.min(extras.length * 2.5, 5);
  if (extras.length > 0) {
    cat.findings.push(`Extra tools: ${extras.length} (harness/openspec)`);
  } else {
    cat.suggestions.push('Consider Harness for agent team design or OpenSpec for process docs');
  }

  return cat;
}

async function auditTeamConsistency(
  targetPath: string,
  analysis: ReturnType<typeof analyze> extends Promise<infer T> ? T : never,
): Promise<AuditCategory> {
  const cat: AuditCategory = {
    name: 'Team Consistency',
    score: 0,
    maxScore: 15,
    findings: [],
    suggestions: [],
  };

  // .roboco/config.json for install reproducibility (5 points)
  if (await fileExists(join(targetPath, '.roboco', 'config.json'))) {
    cat.score += 5;
    cat.findings.push('ROBOCO config: present (roboco install ready)');
  } else {
    cat.suggestions.push('Initialize ROBOCO so teammates can run "roboco install"');
  }

  // Git-tracked config files (5 points)
  if (analysis.git.isRepo) {
    const trackedFiles = ['CLAUDE.md', '.claude/settings.json'];
    let tracked = 0;
    for (const f of trackedFiles) {
      if (await fileExists(join(targetPath, f))) tracked++;
    }
    cat.score += Math.round((tracked / trackedFiles.length) * 5);
    cat.findings.push(`Git-tracked config: ${tracked}/${trackedFiles.length} files`);
    if (tracked < trackedFiles.length) {
      cat.suggestions.push('Commit CLAUDE.md and .claude/settings.json to git');
    }
  }

  // .gitignore includes .env (5 points)
  if (await fileExists(join(targetPath, '.gitignore'))) {
    const content = await readText(join(targetPath, '.gitignore'));
    if (content.includes('.env')) {
      cat.score += 5;
      cat.findings.push('.gitignore: protects .env files');
    } else {
      cat.score += 2;
      cat.suggestions.push('Add .env to .gitignore to protect API keys');
    }
  } else {
    cat.suggestions.push('Add .gitignore with .env protection');
  }

  return cat;
}

function getGrade(percentage: number): string {
  if (percentage >= 90) return 'A';
  if (percentage >= 80) return 'B';
  if (percentage >= 70) return 'C';
  if (percentage >= 60) return 'D';
  return 'F';
}

function printText(
  categories: AuditCategory[],
  total: number,
  max: number,
  pct: number,
  grade: string,
): void {
  logger.plain('ROBOCO Vibe Coding Maturity Audit');
  logger.plain('═════════════════════════════════');
  logger.blank();

  for (const cat of categories) {
    const catPct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
    logger.plain(`  ${cat.name} (${cat.score}/${cat.maxScore} — ${catPct}%)`);
    for (const f of cat.findings) {
      logger.plain(`    ✓ ${f}`);
    }
    for (const s of cat.suggestions) {
      logger.plain(`    → ${s}`);
    }
    logger.blank();
  }

  logger.plain(`  Score: ${total}/${max} (${pct}%) — Grade: ${grade}`);
  logger.blank();

  if (pct >= 90) {
    logger.success('Excellent! Your vibe coding setup is mature and well-configured.');
  } else if (pct >= 70) {
    logger.info('Good foundation. Follow the suggestions above to improve.');
  } else if (pct >= 50) {
    logger.warn('Basic setup. Several areas need attention.');
  } else {
    logger.error('Early stage. Run "roboco init" to get started.');
  }
}

function printMarkdown(
  categories: AuditCategory[],
  total: number,
  max: number,
  pct: number,
  grade: string,
): void {
  logger.plain('# Vibe Coding Maturity Audit\n');
  logger.plain(`**Score:** ${total}/${max} (${pct}%) — **Grade: ${grade}**\n`);
  logger.plain('| Category | Score | % |');
  logger.plain('|----------|-------|---|');
  for (const cat of categories) {
    const catPct = cat.maxScore > 0 ? Math.round((cat.score / cat.maxScore) * 100) : 0;
    logger.plain(`| ${cat.name} | ${cat.score}/${cat.maxScore} | ${catPct}% |`);
  }
  logger.plain('\n## Suggestions\n');
  for (const cat of categories) {
    if (cat.suggestions.length > 0) {
      logger.plain(`### ${cat.name}`);
      for (const s of cat.suggestions) {
        logger.plain(`- ${s}`);
      }
    }
  }
}
