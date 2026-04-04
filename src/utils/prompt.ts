import { createInterface } from 'node:readline';

function createRl() {
  return createInterface({ input: process.stdin, output: process.stdout });
}

export async function confirm(message: string, defaultYes = true): Promise<boolean> {
  const hint = defaultYes ? '[Y/n]' : '[y/N]';
  const rl = createRl();
  return new Promise((resolve) => {
    rl.question(`${message} ${hint} `, (answer: string) => {
      rl.close();
      const trimmed = answer.trim().toLowerCase();
      if (trimmed === '') resolve(defaultYes);
      else resolve(trimmed === 'y' || trimmed === 'yes');
    });
  });
}

export async function select(message: string, choices: string[]): Promise<number> {
  const rl = createRl();
  const list = choices.map((c, i) => `  ${i + 1}) ${c}`).join('\n');
  return new Promise((resolve) => {
    rl.question(`${message}\n${list}\n> `, (answer: string) => {
      rl.close();
      const idx = parseInt(answer.trim(), 10) - 1;
      resolve(idx >= 0 && idx < choices.length ? idx : 0);
    });
  });
}

export async function input(message: string): Promise<string> {
  const rl = createRl();
  return new Promise((resolve) => {
    rl.question(`${message} `, (answer: string) => {
      rl.close();
      resolve(answer.trim());
    });
  });
}
