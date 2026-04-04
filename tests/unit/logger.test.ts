import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { logger, setColorEnabled } from '../../src/utils/logger.js';

describe('logger', () => {
  let consoleSpy: ReturnType<typeof vi.spyOn>;
  let consoleErrorSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    consoleSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
    consoleErrorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    setColorEnabled(false);
  });

  afterEach(() => {
    consoleSpy.mockRestore();
    consoleErrorSpy.mockRestore();
    setColorEnabled(true);
  });

  it('info outputs with ℹ prefix', () => {
    logger.info('test message');
    expect(consoleSpy).toHaveBeenCalledWith('ℹ test message');
  });

  it('success outputs with ✓ prefix', () => {
    logger.success('done');
    expect(consoleSpy).toHaveBeenCalledWith('✓ done');
  });

  it('warn outputs with ⚠ prefix', () => {
    logger.warn('warning');
    expect(consoleSpy).toHaveBeenCalledWith('⚠ warning');
  });

  it('error outputs to stderr with ✗ prefix', () => {
    logger.error('fail');
    expect(consoleErrorSpy).toHaveBeenCalledWith('✗ fail');
  });

  it('plain outputs raw text', () => {
    logger.plain('raw');
    expect(consoleSpy).toHaveBeenCalledWith('raw');
  });

  it('blank outputs empty line', () => {
    logger.blank();
    expect(consoleSpy).toHaveBeenCalledWith();
  });
});
