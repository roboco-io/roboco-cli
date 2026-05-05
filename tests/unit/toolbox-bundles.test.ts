import { describe, it, expect } from 'vitest';
import {
  resolveBundle,
  MARKETPLACE,
  CORE_BUNDLE,
  OVERLAPPING_PLUGINS,
} from '../../src/core/toolbox-bundles.js';

describe('resolveBundle', () => {
  it('returns core bundle for stacks with no overlay', () => {
    expect(resolveBundle(['Python'], { hasProto: false })).toEqual(CORE_BUNDLE);
  });

  it('adds go-dev for Go stack', () => {
    const result = resolveBundle(['Go'], { hasProto: false });
    expect(result).toEqual([...CORE_BUNDLE, 'go-dev']);
  });

  it('adds biome-vcs-integration for TypeScript', () => {
    const result = resolveBundle(['TypeScript'], { hasProto: false });
    expect(result).toEqual([...CORE_BUNDLE, 'biome-vcs-integration']);
  });

  it('adds biome-vcs-integration for JavaScript', () => {
    const result = resolveBundle(['JavaScript'], { hasProto: false });
    expect(result).toEqual([...CORE_BUNDLE, 'biome-vcs-integration']);
  });

  it('does not duplicate when both TypeScript and JavaScript detected', () => {
    const result = resolveBundle(['TypeScript', 'JavaScript'], { hasProto: false });
    expect(result.filter((p) => p === 'biome-vcs-integration')).toHaveLength(1);
  });

  it('adds protobuf-dev when hasProto signal is true', () => {
    const result = resolveBundle(['Go'], { hasProto: true });
    expect(result).toContain('protobuf-dev');
    expect(result).toContain('go-dev');
  });

  it('excludes overlapping plugins from defaults', () => {
    const result = resolveBundle(['Go', 'TypeScript'], { hasProto: true });
    for (const overlap of OVERLAPPING_PLUGINS) {
      expect(result).not.toContain(overlap);
    }
  });

  it('returns marketplace metadata pointing at jaeyeom/claude-toolbox', () => {
    expect(MARKETPLACE.name).toBe('claude-toolbox');
    expect(MARKETPLACE.source).toEqual({ source: 'github', repo: 'jaeyeom/claude-toolbox' });
  });
});
