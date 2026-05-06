import { resolve } from 'node:path';
import ora from 'ora';
import { analyze } from '../core/analyzer.js';
import { interview } from '../core/interviewer.js';
import { generate } from '../core/generator.js';
import { installTools, printInstallReport } from '../core/installer.js';
import { logger } from '../utils/logger.js';
import { fileExists } from '../utils/fs.js';

interface InitOptions {
  auto?: boolean;
  dryrun?: boolean;
}

export async function initCommand(path: string | undefined, options: InitOptions): Promise<void> {
  const targetPath = resolve(path ?? '.');

  // Check if already initialized
  if (await fileExists(resolve(targetPath, '.roboco', 'config.json'))) {
    logger.warn('This repository is already initialized with ROBOCO.');
    logger.info('Run "roboco update" to update the configuration.');
    return;
  }

  // Phase 1: Analyze
  const spinner = ora('Analyzing repository...').start();
  let analysis: Awaited<ReturnType<typeof analyze>>;
  try {
    analysis = await analyze(targetPath);
  } catch (err) {
    spinner.fail('Analysis failed');
    logger.error(err instanceof Error ? err.message : String(err));
    process.exitCode = 1;
    return;
  }
  spinner.succeed('Repository analyzed');

  logger.blank();
  logger.info(`Path: ${analysis.path}`);
  logger.info(`Stack: ${analysis.stack.languages.join(', ') || 'None detected'}`);
  logger.info(`Frameworks: ${analysis.stack.frameworks.join(', ') || 'None'}`);
  logger.info(
    `Git: ${analysis.git.isRepo ? `${analysis.git.repoName ?? 'local'} (${analysis.git.branch})` : 'Not a git repo'}`,
  );
  logger.info(
    `Existing: ${
      [
        analysis.existing.hasClaudeMd && 'CLAUDE.md',
        analysis.existing.hasClaude && '.claude/',
        analysis.existing.hasOmc && '.omc/',
      ]
        .filter(Boolean)
        .join(', ') || 'None'
    }`,
  );

  if (options.dryrun) {
    logger.blank();
    logger.info('Dry run complete. No changes made.');
    return;
  }

  // Phase 2: Interview
  const interviewResult = await interview(analysis, { auto: options.auto ?? false });

  // Phase 3: Generate
  logger.blank();
  const genSpinner = ora('Generating configuration...').start();
  const created = await generate(targetPath, analysis, interviewResult);
  genSpinner.succeed(`Generated ${created.length} files`);

  // Phase 4: Install tools
  logger.blank();
  const installSpinner = ora('Installing tools...').start();
  const installResults = await installTools(interviewResult.tools, analysis);
  installSpinner.succeed('Tool installation complete');
  printInstallReport(installResults);

  // Report
  logger.blank();
  logger.success('ROBOCO initialized successfully!');
  logger.blank();
  logger.info('Next steps:');
  logger.plain('  1. Review CLAUDE.md and customize for your project');
  logger.plain('  2. Start Claude Code: claude');
  logger.plain('  3. Try: "Start the vibe coding process"');
}
