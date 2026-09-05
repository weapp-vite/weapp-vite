import { describe, expect, it, vi } from 'vitest'
import {
  collectRuntimeSizeReport,
  createRuntimeSizeBuildOptions,
  createRuntimeSizePrArtifact,
  formatBytes,
  renderRuntimeSizeMarkdown,
  runtimeSizeTargets,
  runtimeSizeTiers,
} from './runtime-size'

function createReport(options: {
  commit: string
  offset?: number
}) {
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
    version: 2 as const,
    generatedAt: '2026-07-30T00:00:00.000Z',
    commit: options.commit,
    targets: [
      {
        id: 'weapp' as const,
        label: '微信小程序',
        tiers: createTiers('weapp', 0, false),
      },
      {
        id: 'web' as const,
        label: 'Web',
        tiers: createTiers('web', 1024, true),
      },
    ],
  }
}

describe('runtime size targets', () => {
  it('covers the complete miniprogram and web providers', () => {
    expect(runtimeSizeTargets).toEqual([
      expect.objectContaining({
        id: 'weapp',
        gzip: false,
        entries: {
          runtime: 'wevu/internal-runtime',
          reactivity: 'wevu/internal-reactivity',
          template: 'wevu/internal-template',
        },
      }),
      expect.objectContaining({
        id: 'web',
        gzip: true,
        entries: {
          runtime: '@weapp-vite/web/runtime',
          reactivity: 'wevu/internal-reactivity',
          template: 'wevu/internal-template',
        },
      }),
    ])
    expect(runtimeSizeTiers.map(tier => tier.id)).toEqual([
      'reactivity-core',
      'minimal-app',
      'typical-page',
      'complex-component',
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
      target: runtimeSizeTargets[1]!,
      tier: runtimeSizeTiers[2]!,
      mode: 'production',
    }).stdin!.contents as string
    expect(webTreeShaken).toContain('registerWebWevuApp as')
    expect(webTreeShaken).toContain('registerWebWevuComponent as')
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

    expect(report.version).toBe(2)
    expect(bundle).toHaveBeenCalledTimes(runtimeSizeTargets.length * runtimeSizeTiers.length * 2)
    expect(report.targets).toHaveLength(2)
    expect(report.targets[0]).toMatchObject({
      id: 'weapp',
      tiers: expect.arrayContaining([
        expect.objectContaining({ id: 'reactivity-core', dev: { bytes: 1280 }, production: expect.objectContaining({ bytes: 1024 }) }),
        expect.objectContaining({ id: 'full-provider', dev: { bytes: 3328 }, production: expect.objectContaining({ bytes: 3072 }) }),
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
    expect(report.targets[1]!.tiers.every(tier => (
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

    expect(markdown).toContain('| 微信小程序 | 6.00 KiB (+1.00 KiB, +20.00%) | 3.50 KiB (+1.00 KiB, +40.00%) | 不适用 |')
    expect(markdown).toContain('| 响应式核心 | 2.00 KiB (+1.00 KiB, +100.00%) | 1.50 KiB (+1.00 KiB, +200.00%) | 不适用 |')
    expect(markdown).toContain('| 完整 Provider | 7.00 KiB (+1.00 KiB, +16.67%) | 4.50 KiB (+1.00 KiB, +28.57%) | 3.25 KiB (+1.00 KiB, +44.44%) |')
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
      version: 2,
      kind: 'wevu-runtime-size-pr-report',
      repository: 'owner/repo',
      prNumber: 42,
      current,
      baseline,
    }))
  })
})
