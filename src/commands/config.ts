import { join } from 'node:path';
import { homedir } from 'node:os';
import { fileExists, readJson, writeJson } from '../utils/fs.js';
import { logger } from '../utils/logger.js';
import type { GlobalConfig } from '../types/index.js';
import { DEFAULT_GLOBAL_CONFIG } from '../types/index.js';

const CONFIG_PATH = join(homedir(), '.roboco', 'config.json');

export async function configCommand(options: { get?: string; set?: string; reset?: boolean }): Promise<void> {
  if (options.reset) {
    await writeJson(CONFIG_PATH, DEFAULT_GLOBAL_CONFIG);
    logger.success('Configuration reset to defaults');
    return;
  }

  const config = await loadConfig();

  if (options.set) {
    const [key, ...valueParts] = options.set.split('=');
    const value = valueParts.join('=');
    if (!key || value === undefined) {
      logger.error('Usage: roboco config --set key=value');
      process.exit(1);
    }
    setNestedValue(config, key, parseValue(value));
    await writeJson(CONFIG_PATH, config);
    logger.success(`Set ${key} = ${value}`);
    return;
  }

  if (options.get) {
    const value = getNestedValue(config, options.get);
    if (value === undefined) {
      logger.error(`Key "${options.get}" not found`);
      process.exit(1);
    }
    logger.plain(typeof value === 'object' ? JSON.stringify(value, null, 2) : String(value));
    return;
  }

  // Show all config
  logger.plain('ROBOCO Configuration');
  logger.plain('════════════════════');
  logger.plain(`Path: ${CONFIG_PATH}`);
  logger.blank();
  logger.plain(JSON.stringify(config, null, 2));
}

async function loadConfig(): Promise<GlobalConfig> {
  if (await fileExists(CONFIG_PATH)) {
    return readJson<GlobalConfig>(CONFIG_PATH);
  }
  return { ...DEFAULT_GLOBAL_CONFIG };
}

function parseValue(value: string): unknown {
  if (value === 'true') return true;
  if (value === 'false') return false;
  const num = Number(value);
  if (!isNaN(num)) return num;
  try { return JSON.parse(value); } catch { return value; }
}

function getNestedValue(obj: Record<string, unknown>, path: string): unknown {
  return path.split('.').reduce<unknown>((acc, key) => {
    if (acc && typeof acc === 'object') return (acc as Record<string, unknown>)[key];
    return undefined;
  }, obj);
}

function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  const last = keys.pop()!;
  let current: Record<string, unknown> = obj;
  for (const key of keys) {
    if (!(key in current) || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = current[key] as Record<string, unknown>;
  }
  current[last] = value;
}
