import chalk from 'chalk';

let colorEnabled = true;

export function setColorEnabled(enabled: boolean): void {
  colorEnabled = enabled;
}

function wrap(fn: (s: string) => string, msg: string): string {
  return colorEnabled ? fn(msg) : msg;
}

export const logger = {
  info(msg: string): void {
    console.log(wrap(chalk.blue, 'ℹ') + ' ' + msg);
  },
  success(msg: string): void {
    console.log(wrap(chalk.green, '✓') + ' ' + msg);
  },
  warn(msg: string): void {
    console.log(wrap(chalk.yellow, '⚠') + ' ' + msg);
  },
  error(msg: string): void {
    console.error(wrap(chalk.red, '✗') + ' ' + msg);
  },
  debug(msg: string): void {
    if (process.env['DEBUG']) {
      console.log(wrap(chalk.gray, '⊡') + ' ' + msg);
    }
  },
  plain(msg: string): void {
    console.log(msg);
  },
  blank(): void {
    console.log();
  },
};
