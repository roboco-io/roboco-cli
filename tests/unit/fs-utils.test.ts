import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { writeJson, readJson, fileExists } from '../../src/utils/fs.js';

describe('config utils', () => {
  let tempDir: string;

  beforeEach(async () => {
    tempDir = await mkdtemp(join(tmpdir(), 'roboco-config-'));
  });

  afterEach(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  it('writeJson creates file with pretty JSON', async () => {
    const path = join(tempDir, 'test.json');
    await writeJson(path, { key: 'value' });
    const result = await readJson<{ key: string }>(path);
    expect(result.key).toBe('value');
  });

  it('writeJson creates nested directories', async () => {
    const path = join(tempDir, 'a', 'b', 'test.json');
    await writeJson(path, { nested: true });
    expect(await fileExists(path)).toBe(true);
  });

  it('fileExists returns false for missing files', async () => {
    expect(await fileExists(join(tempDir, 'nope.json'))).toBe(false);
  });
});
