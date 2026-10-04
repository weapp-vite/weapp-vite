import type { RuntimeSizeReport } from './runtime-size'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { describe, expect, it, vi } from 'vitest'
import { collectPerformanceReports } from '../.github/scripts/performance-comment-report.mjs'
import { validateReport } from '../.github/scripts/runtime-size-schema.mjs'
import {
  collectRuntimeSizeReport,
  createRuntimeSizeBuildOptions,
  createRuntimeSizePrArtifact,
  formatBytes,
  readRuntimeSizeReport,
  renderRuntimeSizeMarkdown,
  runtimeSizeTargets,
  runtimeSizeTiers,
} from './runtime-size'

function createReport(options: {
  commit: string
  offset?: number
}): RuntimeSizeReport {
  const createTiers = (targetId: string, platformOffset: number, gzip: boolean) => runtimeSizeTiers.map((tier, index) => {
    const entry = `wevu-runtime-size-${targetId}-${tier.id}-production.mjs`
    return {
      id: tier.id,
      label: tier.label,
      dev: { bytes: 1024 * (index + 1) + platformOffset + (options.offset ?? 0) },
      production: {
        bytes: 512 * (index + 1) + platformOffset + (options.offset ?? 0),
        ...(gzip ? { gzipBytes: 256 * (index + 1) + platformOffset + (options.offset ?? 0) } : {}),
        retainedModules: {
          entry,
          modules: [{ path: entry, bytesInOutput: 1, imports: [] }],
        },
      },
    }
  })
  return {
    version: 4 as const,
    generatedAt: '2026-07-30T00:00:00.000Z',
    commit: options.commit,
    targets: runtimeSizeTargets.map(target => ({
      id: target.id,
      label: target.label,
      tiers: createTiers(target.id, target.gzip ? 1024 : 0, target.gzip),
    })),
  }
}

describe('runtime size targets', () => {
  it('covers the complete miniprogram and web providers', () => {
    expect(runtimeSizeTargets.map(target => target.id)).toEqual(['weapp', 'alipay', 'tt', 'swan', 'jd', 'xhs', 'web'])
    expect(runtimeSizeTargets.filter(target => !target.gzip).every(target => target.entries.runtime === 'wevu/internal-runtime')).toBe(true)
    expect(runtimeSizeTargets.find(target => target.id === 'web')?.entries.runtime).toBe('@weapp-vite/web/runtime')
    expect(runtimeSizeTiers.map(tier => tier.id)).toEqual([
      'reactivity-core',
      'minimal-app',
      'typical-page',
      'complex-component',
      'public-app',
      'public-page',
      'full-provider',
    ])
    expect(runtimeSizeTiers[2]!.imports?.runtime).toEqual(expect.arrayContaining([
      'createApp',
      'createWevuComponent',
      'onLoad',
    ]))
    expect(runtimeSizeTiers[3]!.imports?.runtime).toEqual(expect.arrayContaining([
      ...runtimeSizeTiers[2]!.imports!.runtime!,
      'provide',
      'useBindModel',
    ]))
    expect(runtimeSizeTiers[1]!.targetImports?.web?.runtime).toEqual(['registerWebWevuApp'])
    expect(runtimeSizeTiers[2]!.targetImports?.web?.runtime).toEqual([
      'registerWebWevuApp',
      'registerWebWevuComponent',
    ])
  })

  it('uses development conditions without minification and minifies production', () => {
    const target = runtimeSizeTargets[0]!
    const tier = runtimeSizeTiers[0]!
    const dev = createRuntimeSizeBuildOptions({ root: '/repo', target, tier, mode: 'development' })
    const production = createRuntimeSizeBuildOptions({ root: '/repo', target, tier, mode: 'production' })

    expect(dev.conditions).toEqual(['development'])
    expect(dev.metafile).toBe(true)
    expect(dev.minify).toBe(false)
    expect(dev.define?.['import.meta.env.DEV']).toBe('true')
    expect(dev.sourcemap).toBe(false)
    expect(production.conditions).toEqual([])
    expect(production.minify).toBe(true)
    expect(production.define?.['import.meta.env.PROD']).toBe('true')
  })

  it('uses named imports for tiers and namespaces only for the full provider', () => {
    const target = runtimeSizeTargets[0]!
    const treeShaken = createRuntimeSizeBuildOptions({
      root: '/repo',
      target,
      tier: runtimeSizeTiers[2]!,
      mode: 'production',
    }).stdin!.contents as string
    const fullProvider = createRuntimeSizeBuildOptions({
      root: '/repo',
      target,
      tier: runtimeSizeTiers[runtimeSizeTiers.length - 1]!,
      mode: 'production',
    }).stdin!.contents as string

    expect(treeShaken).toContain('import { createApp as')
    expect(treeShaken).toContain('import { ref as')
    expect(treeShaken).not.toContain('import * as')
    expect(fullProvider).toContain('import * as provider0')
    expect(fullProvider).toContain('wevu/internal-template')

    const webTreeShaken = createRuntimeSizeBuildOptions({
      root: '/repo',
      target: runtimeSizeTargets.find(target => target.id === 'web')!,
      tier: runtimeSizeTiers[2]!,
      mode: 'production',
    }).stdin!.contents as string
    expect(webTreeShaken).toContain('registerWebWevuApp as')
    expect(webTreeShaken).toContain('registerWebWevuComponent as')
  })
})

describe('runtime size import graph compatibility', () => {
  it('reads legacy v4 and preserves complete input graphs through report collection', async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), 'runtime-size-graph-'))
    try {
      const baseline = createReport({ commit: 'abc1234' })
      const baselineFile = path.join(root, 'baseline.json')
      await writeFile(baselineFile, JSON.stringify(baseline))
      const legacy = await readRuntimeSizeReport(baselineFile)
      expect(legacy).toEqual(baseline)
      expect(legacy.targets[0]!.tiers[0]!.production.retainedModules.importGraph).toBeUndefined()

      const current = createReport({ commit: 'def5678' })
      const retained = current.targets[0]!.tiers[0]!.production.retainedModules
      retained.modules.push({ path: 'runtime.mjs', bytesInOutput: 10, imports: [] })
      retained.importGraph = [
        { path: retained.entry, imports: ['barrel.mjs'] },
        { path: 'barrel.mjs', imports: ['runtime.mjs'] },
        { path: 'runtime.mjs', imports: ['barrel.mjs'] },
      ]
      const currentFile = path.join(root, 'current.json')
      await writeFile(currentFile, JSON.stringify(current))
      expect(await readRuntimeSizeReport(currentFile)).toEqual(current)
      await writeFile(path.join(root, 'report-full.json'), JSON.stringify(createRuntimeSizePrArtifact({
        repository: 'owner/repo',
        prNumber: 42,
        headSha: current.commit,
        baseSha: baseline.commit,
        current,
        baseline,
      })))
      const result = await collectPerformanceReports({ runtimeRoot: root, performanceRoot: undefined, runtimeExpected: {} }) as {
        errors: string[]
        runtimeSize?: { current: RuntimeSizeReport, baseline: RuntimeSizeReport }
      }
      expect(result.errors).toEqual([])
      expect(result.runtimeSize).toEqual({ current, baseline })
      expect(result.runtimeSize?.current.targets[0]!.tiers[0]!.production.retainedModules.importGraph).toEqual(retained.importGraph)
    }
    finally {
      await rm(root, { recursive: true, force: true })
    }
  })

  it.each([
    { name: 'null', graph: null, error: 'must be an array' },
    { name: 'object', graph: {}, error: 'must be an array' },
    { name: 'empty', graph: [], error: 'must contain its entry' },
    { name: 'missing entry', graph: [{ path: 'other.mjs', imports: [] }], error: 'must contain its entry' },
    { name: 'duplicate paths', graph: [{ path: 'entry', imports: [] }, { path: 'entry', imports: [] }], error: 'unique paths' },
    { name: 'empty path', graph: [{ path: '', imports: [] }], error: 'non-empty string' },
    { name: 'missing imports', graph: [{ path: 'entry' }], error: 'non-empty strings' },
    { name: 'non-string import', graph: [{ path: 'entry', imports: [1] }], error: 'non-empty strings' },
    { name: 'empty import', graph: [{ path: 'entry', imports: [''] }], error: 'non-empty strings' },
    { name: 'dangling edge', graph: [{ path: 'entry', imports: ['missing.mjs'] }], error: 'reference graph nodes' },
  ])('rejects $name graphs', ({ graph, error }) => {
    const report = createReport({ commit: 'abc1234' })
    const retained = report.targets[0]!.tiers[0]!.production.retainedModules
    Object.assign(retained, { entry: 'entry', modules: [{ path: 'entry', bytesInOutput: 1, imports: [] }], importGraph: graph })
    expect(() => validateReport(report, 'report', report.version)).toThrow(error)
  })

  it('rejects complete graphs that omit a retained module', () => {
    const report = createReport({ commit: 'abc1234' })
    const retained = report.targets[0]!.tiers[0]!.production.retainedModules
    retained.modules.push({ path: 'runtime.mjs', bytesInOutput: 10, imports: [] })
    retained.importGraph = [{ path: retained.entry, imports: [] }]
    expect(() => validateReport(report, 'report', report.version)).toThrow('must contain every retained module')
  })
})

describe('collectRuntimeSizeReport', () => {
  it('records exact bytes, production retained modules, and web gzip', async () => {
    const bundle = vi.fn(async ({ target, tier, mode }: { target: { id: string }, tier: { id: string }, mode: string }) => {
      const tierIndex = runtimeSizeTiers.findIndex(candidate => candidate.id === tier.id)
      const length = (target.id === 'weapp' ? 1024 : 4096)
        + tierIndex * 512
        + (mode === 'development' ? 256 : 0)
      const entry = `wevu-runtime-size-${target.id}-${tier.id}-${mode}.mjs`
      return {
        contents: new Uint8Array(length),
        retainedModules: {
          entry,
          modules: [{ path: entry, bytesInOutput: 1, imports: [] }],
        },
      }
    })

    const report = await collectRuntimeSizeReport({
      root: '/repo',
      commit: 'abc123',
      generatedAt: '2026-07-30T00:00:00.000Z',
      bundle,
    })

    expect(report.version).toBe(4)
    expect(bundle).toHaveBeenCalledTimes(runtimeSizeTargets.length * runtimeSizeTiers.length * 2)
    expect(report.targets).toHaveLength(7)
    expect(report.targets[0]).toMatchObject({
      id: 'weapp',
      tiers: expect.arrayContaining([
        expect.objectContaining({ id: 'reactivity-core', dev: { bytes: 1280 }, production: expect.objectContaining({ bytes: 1024 }) }),
        expect.objectContaining({ id: 'full-provider', dev: { bytes: 4352 }, production: expect.objectContaining({ bytes: 4096 }) }),
      ]),
    })
    expect(report.targets[0]!.tiers.every(tier => tier.production.gzipBytes === undefined)).toBe(true)
    expect(report.targets[0]!.tiers[0]!.production.retainedModules).toEqual({
      entry: 'wevu-runtime-size-weapp-reactivity-core-production.mjs',
      modules: [{
        path: 'wevu-runtime-size-weapp-reactivity-core-production.mjs',
        bytesInOutput: 1,
        imports: [],
      }],
    })
    expect(report.targets.find(target => target.id === 'web')!.tiers.every(tier => (
      tier.production.gzipBytes !== undefined
      && tier.production.gzipBytes > 0
      && tier.production.gzipBytes < tier.production.bytes
    ))).toBe(true)
  })
})

describe('runtime size report rendering', () => {
  it('formats positive, negative, and zero deltas in a stable table', () => {
    const baseline = createReport({ commit: 'base' })
    const current = createReport({ commit: 'head', offset: 1024 })

    const markdown = renderRuntimeSizeMarkdown(current, baseline)

    expect(markdown).toContain('| 微信小程序 | 8.00 KiB (+1.00 KiB, +14.29%) | 4.50 KiB (+1.00 KiB, +28.57%) | 不适用 |')
    expect(markdown).toContain('| 响应式核心 | 2.00 KiB (+1.00 KiB, +100.00%) | 1.50 KiB (+1.00 KiB, +200.00%) | 不适用 |')
    expect(markdown).toContain('| 完整 Provider | 9.00 KiB (+1.00 KiB, +12.50%) | 5.50 KiB (+1.00 KiB, +22.22%) | 3.75 KiB (+1.00 KiB, +36.36%) |')
    expect(markdown).toContain('具名导入模拟正常 tree-shaking')
    expect(markdown).not.toContain('retainedModules')
    expect(formatBytes(-1024)).toBe('-1.00 KiB')
  })

  it('creates a versioned PR artifact with exact reports', () => {
    const current = createReport({ commit: 'head' })
    const baseline = createReport({ commit: 'base' })
    expect(createRuntimeSizePrArtifact({
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'head-sha',
      baseSha: 'base-sha',
      current,
      baseline,
    })).toEqual(expect.objectContaining({
      version: 4,
      kind: 'wevu-runtime-size-pr-report',
      repository: 'owner/repo',
      prNumber: 42,
      current,
      baseline,
    }))
  })
})
