import { describe, expect, it } from 'vitest'
import { resolveSubPackageEntries } from './subpackages'

describe('resolveSubPackageEntries', () => {
  it('dedupes overlapping entry and plugin export targets', () => {
    const entries = resolveSubPackageEntries({
      root: 'pkgA',
      pages: ['pages/a', 'pages/b'],
      entry: 'index.js',
      plugins: {
        demo: {
          export: 'index.js',
        },
      },
    } as any)

    expect(entries).toEqual([
      'pkgA/pages/a',
      'pkgA/pages/b',
      'pkgA/index',
    ])
  })
})
