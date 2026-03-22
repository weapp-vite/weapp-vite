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

  it('dedupes when page, entry and plugin export resolve to the same path', () => {
    const entries = resolveSubPackageEntries({
      root: 'pkgB',
      pages: ['index'],
      entry: 'index.ts',
      plugins: {
        demo: {
          export: 'index.js',
        },
      },
    } as any)

    expect(entries).toEqual([
      'pkgB/index',
    ])
  })

  it('ignores invalid plugin export values while preserving unique page and entry results', () => {
    const entries = resolveSubPackageEntries({
      root: 'pkgC',
      pages: ['pages/a', 'pages/a'],
      entry: 'entry/index.js',
      plugins: {
        empty: {
          export: '   ',
        },
        invalid: null,
        valid: {
          export: 'entry/index.js',
        },
      },
    } as any)

    expect(entries).toEqual([
      'pkgC/pages/a',
      'pkgC/entry/index',
    ])
  })
})
