import { describe, expect, it } from 'vitest'
import { renderBatch } from './transport'

describe('stateful hmr transport', () => {
  it('renders executable deltas only into the literal update module', () => {
    const source = renderBatch({
      buildId: 'build-a',
      deltas: [
        { changedIds: ['src/a.ts'], code: 'patchOne();' },
        { changedIds: ['src/b.ts', 'src/a.ts'], code: 'patchTwo();' },
      ],
      fromVersion: 2,
      targetVersion: 4,
    }, 'nonce-a')

    expect(source).toContain('// nonce-a')
    expect(source).toContain('"fromVersion":2')
    expect(source).toContain('"targetVersion":4')
    expect(source).toContain('"changedIds":["src/a.ts","src/b.ts"]')
    expect(source).toContain('  patchOne();')
    expect(source).toContain('  patchTwo();')
    expect(source).not.toContain('applyChangedModules(["src/a.ts","src/b.ts"])')
    expect(source).not.toMatch(/\beval\s*\(|new\s+Function|\bFunction\s*\(/)
  })
})
