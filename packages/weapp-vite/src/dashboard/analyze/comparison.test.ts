import type { ModuleInFile, PackageReport } from '../../analyze/subpackages/types'
import { describe, expect, it } from 'vitest'
import { createAnalyzeComparison } from './index'

function createPackage(id: string, size: number, modules: ModuleInFile[] = []): PackageReport {
  return {
    id,
    label: id,
    type: 'subPackage',
    files: [{ file: `${id}/index.js`, type: 'chunk', from: 'main', size, modules }],
  }
}

describe('shared analyze comparison', () => {
  it('distinguishes zero-byte membership changes from unchanged entries in every scope', () => {
    const previous = { packages: [
      createPackage('removed', 0, [{ id: 'removed', source: 'removed.ts', sourceType: 'src', bytes: 0 }]),
      createPackage('unchanged', 0),
    ] }
    const current = { packages: [
      createPackage('added', 0, [{ id: 'added', source: 'added.ts', sourceType: 'src', bytes: 0 }]),
      createPackage('unchanged', 0),
    ] }
    const comparison = createAnalyzeComparison(current, previous)

    expect(comparison).toMatchObject({ currentBytes: 0, previousBytes: 0, deltaBytes: 0 })
    for (const scope of ['packages', 'files', 'modules'] as const) {
      expect(comparison[scope]).toEqual([
        expect.objectContaining({ change: 'added', packageId: 'added', currentBytes: 0, previousBytes: 0, deltaBytes: 0 }),
        expect.objectContaining({ change: 'removed', packageId: 'removed', currentBytes: 0, previousBytes: 0, deltaBytes: 0 }),
      ])
    }
    expect(comparison.modules[1]).toMatchObject({ moduleId: 'removed', file: 'removed/index.js' })
  })

  it('reports growth and shrinkage while deriving total delta only from artifacts', () => {
    const previous = { packages: [
      createPackage('growing', 0, [{ id: 'grow', source: 'grow.ts', sourceType: 'src', bytes: 0 }]),
      createPackage('shrinking', 100, [{ id: 'shrink', source: 'shrink.ts', sourceType: 'src', bytes: 500 }]),
    ] }
    const current = { packages: [
      createPackage('growing', 20, [{ id: 'grow', source: 'grow.ts', sourceType: 'src', bytes: 20 }]),
      createPackage('shrinking', 40, [{ id: 'shrink', source: 'shrink.ts', sourceType: 'src', bytes: 0 }]),
    ] }
    const comparison = createAnalyzeComparison(current, previous)

    expect(comparison).toMatchObject({ currentBytes: 60, previousBytes: 100, deltaBytes: -40 })
    for (const scope of ['packages', 'files'] as const) {
      expect(comparison[scope]).toEqual([
        expect.objectContaining({ change: 'increased', packageId: 'growing', deltaBytes: 20 }),
        expect.objectContaining({ change: 'decreased', packageId: 'shrinking', deltaBytes: -60 }),
      ])
    }
    expect(comparison.modules).toEqual([
      expect.objectContaining({ change: 'increased', moduleId: 'grow', deltaBytes: 20 }),
      expect.objectContaining({ change: 'decreased', moduleId: 'shrink', currentBytes: 0, previousBytes: 500, deltaBytes: -500 }),
    ])
  })

  it('matches canonical variants but preserves the selected raw module and its first placement', () => {
    const previous = { packages: [createPackage('main', 100, [
      { id: 'old', source: 'components/Widget.vue?old', sourceType: 'src', bytes: 100 },
    ])] }
    const current = { packages: [
      createPackage('main', 100, [
        { id: 'new', source: 'components\\Widget.vue?new', sourceType: 'src', bytes: 110 },
        { id: 'sidecar', source: 'components/Widget.vue?sidecar', sourceType: 'src', bytes: 90 },
      ]),
      createPackage('feature', 100, [
        { id: 'new', source: 'components\\Widget.vue?new', sourceType: 'src', bytes: 120 },
      ]),
    ] }
    const comparison = createAnalyzeComparison(current, previous)

    expect(comparison.modules).toEqual([expect.objectContaining({
      moduleId: 'new',
      packageId: 'main',
      file: 'main/index.js',
      label: 'components\\Widget.vue?new',
      change: 'increased',
      previousBytes: 100,
      currentBytes: 120,
      deltaBytes: 20,
    })])
    expect(comparison.modules[0]?.key).toBe('module:src\0components/Widget.vue')
  })

  it('does not collide package and file identities containing delimiter characters', () => {
    const previous = { packages: [{ ...createPackage('a:b', 10), files: [{ file: 'c', type: 'asset' as const, from: 'main' as const, size: 10 }] }] }
    const current = { packages: [{ ...createPackage('a', 10), files: [{ file: 'b:c', type: 'asset' as const, from: 'main' as const, size: 10 }] }] }

    expect(createAnalyzeComparison(current, previous).files).toEqual([
      expect.objectContaining({ packageId: 'a', file: 'b:c', change: 'added', deltaBytes: 10 }),
      expect.objectContaining({ packageId: 'a:b', file: 'c', change: 'removed', deltaBytes: -10 }),
    ])
  })

  it.each([false, true])('does not invent a size delta when measurement availability changes (reverse=%s)', (reverse) => {
    const known = { packages: [createPackage('main', 100, [{ id: 'a', source: 'a.ts', sourceType: 'src', bytes: 40 }])] }
    const unknown = structuredClone(known)
    delete unknown.packages[0]!.files[0]!.size
    delete unknown.packages[0]!.files[0]!.modules![0]!.bytes
    const comparison = createAnalyzeComparison(reverse ? known : unknown, reverse ? unknown : known)

    expect(comparison).toMatchObject({
      currentBytes: reverse ? 100 : null,
      previousBytes: reverse ? null : 100,
      deltaBytes: null,
      currentUnmeasuredFiles: reverse ? 0 : 1,
      previousUnmeasuredFiles: reverse ? 1 : 0,
    })
    for (const scope of ['packages', 'files', 'modules'] as const) {
      const bytes = scope === 'modules' ? 40 : 100
      expect(comparison[scope]).toEqual([expect.objectContaining({
        change: 'unmeasured',
        currentBytes: reverse ? bytes : null,
        previousBytes: reverse ? null : bytes,
        deltaBytes: null,
      })])
    }
    expect(createAnalyzeComparison(unknown, { packages: [] }).files).toEqual([
      expect.objectContaining({ change: 'added', currentBytes: null, previousBytes: 0, deltaBytes: null }),
    ])
    expect(createAnalyzeComparison({ packages: [] }, unknown).files).toEqual([
      expect.objectContaining({ change: 'removed', currentBytes: 0, previousBytes: null, deltaBytes: null }),
    ])
  })

  it('keeps a canonical module unmeasured when any occurrence has no size', () => {
    const previous = { packages: [createPackage('main', 100, [{ id: 'a', source: 'a.ts', sourceType: 'src', bytes: 40 }])] }
    const current = { packages: [createPackage('main', 100, [
      { id: 'a', source: 'a.ts', sourceType: 'src', bytes: 50 },
      { id: 'a', source: 'a.ts', sourceType: 'src' },
      { id: 'variant', source: 'a.ts?variant', sourceType: 'src', bytes: 60 },
    ])] }
    expect(createAnalyzeComparison(current, previous).modules).toEqual([
      expect.objectContaining({ change: 'unmeasured', currentBytes: null, previousBytes: 40, deltaBytes: null }),
    ])
  })
})
