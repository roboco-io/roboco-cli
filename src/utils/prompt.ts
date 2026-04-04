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
