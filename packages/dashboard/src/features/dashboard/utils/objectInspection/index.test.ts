import type { DashboardInvestigationTarget } from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult } from '../../types'
import { describe, expect, it } from 'vitest'
import { createInspectionIndex, filterInspectionNodes, inspectionTargetKey, resolveInspectionRelationTargets, resolveInspectionTarget } from './index'

function createReport(): AnalyzeSubpackagesResult {
  return {
    packages: [
      { id: 'main', label: '主包', type: 'main', files: Array.from({ length: 25 }, (_, index) => ({
        file: `pages/${index}/index.js`,
        type: 'chunk',
        from: 'main',
        size: index === 0 ? 0 : undefined,
        modules: index === 0 ? [{ id: 'module-a', source: 'src/shared.ts', sourceType: 'src', bytes: 0, originalBytes: 40 }] : [],
      })) },
      { id: 'sub', label: '分包', type: 'subPackage', files: [{ file: 'pages/0/index.js', type: 'asset', from: 'main', size: 12, gzipSize: 0 }] },
    ],
    modules: [
      { id: 'module-a', source: 'src/shared.ts', sourceType: 'src', packages: [{ packageId: 'main', files: ['pages/0/index.js'] }] },
      { id: 'asset-source', source: 'src/image.png', sourceType: 'src', packages: [{ packageId: 'sub', files: ['pages/0/index.js', 'missing.png'] }] },
    ],
    subPackages: [],
  }
}

describe('object inspection report membership', () => {
  it('retains every artifact beyond the former top eighteen and distinguishes packages', () => {
    const index = createInspectionIndex(createReport())
    expect(index.artifacts).toHaveLength(26)
    expect(filterInspectionNodes(index.artifacts, 'pages/24', '')).toHaveLength(1)
    expect(filterInspectionNodes(index.artifacts, 'pages/0/', '')).toHaveLength(2)
    expect(new Set(index.artifacts.map(node => node.key)).size).toBe(26)
  })

  it('preserves measured zero, missing compression and attribution as different evidence', () => {
    const index = createInspectionIndex(createReport())
    expect(index.artifacts[0]?.measurements).toMatchObject({ rawBytes: 0, gzipBytes: null, brotliBytes: null })
    expect(index.artifacts[25]?.measurements).toMatchObject({ rawBytes: 12, gzipBytes: 0 })
    expect(index.packages[0]?.measurements.rawBytes).toBeNull()
    expect(index.modules[0]?.measurements).toMatchObject({ rawBytes: null, attributedBytes: 0, sourceBytes: 40 })
  })

  it('deduplicates real module placements without inventing read permission for reverse links', () => {
    const index = createInspectionIndex(createReport())
    expect(index.modules).toHaveLength(3)
    expect(index.modules[0]?.sourcePath).toBe('src/shared.ts')
    expect(index.modules[1]).toMatchObject({ sourcePath: null, placementOnly: true, measurements: { attributedBytes: null, sourceBytes: null } })
    expect(index.modules[2]?.target).toEqual({ kind: 'module', packageId: 'sub', file: 'missing.png', moduleId: 'asset-source' })
    expect(index.artifacts).toHaveLength(26)
  })

  it('resolves selection independently from explicit filters and falls back without mutating input', () => {
    const index = createInspectionIndex(createReport())
    const target: DashboardInvestigationTarget = { kind: 'artifact', packageId: 'main', file: 'pages/24/index.js' }
    const before = filterInspectionNodes(index.artifacts, 'pages/', 'main')
    expect(resolveInspectionTarget(index, target)?.key).toBe(inspectionTargetKey(target))
    expect(filterInspectionNodes(index.artifacts, 'pages/', 'main')).toEqual(before)
    const missing: DashboardInvestigationTarget = { kind: 'artifact', packageId: 'main', file: 'removed.js' }
    expect(resolveInspectionTarget(index, missing)).toBe(index.artifacts[0])
    expect(missing.file).toBe('removed.js')
    expect(resolveInspectionTarget(createInspectionIndex({ packages: [], modules: [], subPackages: [] }), null)).toBeNull()
  })

  it('reveals the selected package chain instead of same-named artifacts in another package', () => {
    const index = createInspectionIndex(createReport())
    const pkg = index.packages[1]!
    const artifact = index.artifacts[25]!
    const module = index.modules[1]!
    for (const selected of [pkg, artifact, module]) {
      expect(resolveInspectionRelationTargets(index, selected)).toEqual([pkg, artifact, module])
    }
  })

  it('keeps the exact module placement when its parent artifact is absent', () => {
    const index = createInspectionIndex(createReport())
    const module = index.modules[2]!
    expect(resolveInspectionRelationTargets(index, module)).toEqual([index.packages[1], module])
    expect(resolveInspectionRelationTargets(index, index.artifacts[24]!)).toEqual([index.packages[0], index.artifacts[24]])
  })

  it('does not reveal filtered-out nodes or substitute unrelated descendants', () => {
    const index = createInspectionIndex(createReport())
    const selected = index.packages[1]!
    const mainArtifacts = filterInspectionNodes(index.artifacts, '', 'main')
    expect(resolveInspectionRelationTargets({ ...index, artifacts: mainArtifacts }, selected)).toEqual([selected])
    const hiddenPackage = { ...index, packages: [] }
    expect(resolveInspectionRelationTargets(hiddenPackage, selected)).toEqual([index.artifacts[25], index.modules[1]])
    expect(resolveInspectionRelationTargets({ ...index, modules: [] }, selected)).toEqual([selected, index.artifacts[25]])
    expect(resolveInspectionRelationTargets(index, null)).toEqual([])
  })
})
