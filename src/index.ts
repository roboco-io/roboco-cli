import { Command } from 'commander';
import { setColorEnabled } from './utils/logger.js';
import { initCommand } from './commands/init.js';
import { installCommand } from './commands/install.js';
import { updateCommand } from './commands/update.js';
import { statusCommand } from './commands/status.js';
import { doctorCommand } from './commands/doctor.js';
import { configCommand } from './commands/config.js';

const program = new Command();

program
  .name('roboco')
  .description('AI-native development scaffolding system')
  .version('0.1.0')
  .option('--no-color', 'Disable color output')
  .hook('preAction', (thisCommand) => {
    const opts = thisCommand.opts() as { color?: boolean };
    if (opts.color === false) {
      setColorEnabled(false);
    }
  });

program
  .command('init')
  .argument('[path]', 'Target repository path', '.')
  .description('Initialize ROBOCO vibe coding environment')
  .option('--auto', 'Auto-setup with AI suggestions')
  .option('--dryrun', 'Analyze and suggest without changes')
  .action(initCommand);

program
  .command('install')
  .argument('[path]', 'Target repository path', '.')
  .description('Apply existing config for team members')
  .action(installCommand);

program
  .command('update')
  .argument('[path]', 'Target repository path', '.')
  .description('Update existing ROBOCO configuration')
  .option('--auto', 'Auto-update with AI suggestions')
  .action(updateCommand);

program
  .command('status')
  .argument('[path]', 'Target repository path', '.')
  .description('Report vibe coding setup status')
  .option('--format <type>', 'Output format: text, markdown', 'text')
  .action(statusCommand);

program
  .command('doctor')
  .description('Diagnose ROBOCO CLI health')
  .action(doctorCommand);

program
  .command('config')
  .description('View and modify global ROBOCO configuration')
  .option('--get <key>', 'Get a config value')
  .option('--set <key=value>', 'Set a config value')
  .option('--reset', 'Reset to defaults')
  .action(configCommand);

program.parse();
