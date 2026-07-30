import { describe, expect, it, vi } from 'vitest'
import {
  collectRuntimeSizeReport,
  createRuntimeSizeBuildOptions,
  createRuntimeSizePrArtifact,
  formatBytes,
  renderRuntimeSizeMarkdown,
  runtimeSizeTargets,
} from './runtime-size'

function createReport(options: {
  commit: string
  weappDev: number
  weappProduction: number
  webDev: number
  webProduction: number
  webGzip: number
}) {
  return {
    version: 1 as const,
    generatedAt: '2026-07-30T00:00:00.000Z',
    commit: options.commit,
    targets: [
      {
        id: 'weapp' as const,
        label: '微信小程序',
        dev: { bytes: options.weappDev },
        production: { bytes: options.weappProduction },
      },
      {
        id: 'web' as const,
        label: 'Web',
        dev: { bytes: options.webDev },
        production: { bytes: options.webProduction, gzipBytes: options.webGzip },
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
        entries: [
          'wevu/internal-runtime',
          'wevu/internal-reactivity',
          'wevu/internal-template',
        ],
      }),
      expect.objectContaining({
        id: 'web',
        gzip: true,
        entries: [
          '@weapp-vite/web/runtime',
          'wevu/internal-reactivity',
          'wevu/internal-template',
        ],
      }),
    ])
  })

  it('uses development conditions without minification and minifies production', () => {
    const target = runtimeSizeTargets[0]!
    const dev = createRuntimeSizeBuildOptions({ root: '/repo', target, mode: 'development' })
    const production = createRuntimeSizeBuildOptions({ root: '/repo', target, mode: 'production' })

    expect(dev.conditions).toEqual(['development'])
    expect(dev.minify).toBe(false)
    expect(dev.define?.['import.meta.env.DEV']).toBe('true')
    expect(dev.sourcemap).toBe(false)
    expect(production.conditions).toEqual([])
    expect(production.minify).toBe(true)
    expect(production.define?.['import.meta.env.PROD']).toBe('true')
  })
})

describe('collectRuntimeSizeReport', () => {
  it('records exact bytes and gzip only for web production', async () => {
    const bundle = vi.fn(async ({ target, mode }: { target: { id: string }, mode: string }) => {
      const length = target.id === 'weapp'
        ? mode === 'development' ? 2048 : 1024
        : mode === 'development' ? 4096 : 8192
      return new Uint8Array(length)
    })

    const report = await collectRuntimeSizeReport({
      root: '/repo',
      commit: 'abc123',
      generatedAt: '2026-07-30T00:00:00.000Z',
      bundle,
    })

    expect(bundle).toHaveBeenCalledTimes(4)
    expect(report.targets).toHaveLength(2)
    expect(report.targets[0]).toMatchObject({
      id: 'weapp',
      dev: { bytes: 2048 },
      production: { bytes: 1024 },
    })
    expect(report.targets[0]!.production).not.toHaveProperty('gzipBytes')
    expect(report.targets[1]).toMatchObject({
      id: 'web',
      dev: { bytes: 4096 },
      production: { bytes: 8192 },
    })
    expect(report.targets[1]!.production.gzipBytes).toBeGreaterThan(0)
    expect(report.targets[1]!.production.gzipBytes).toBeLessThan(8192)
  })
})

describe('runtime size report rendering', () => {
  it('formats positive, negative, and zero deltas in a stable table', () => {
    const baseline = createReport({
      commit: 'base',
      weappDev: 1024,
      weappProduction: 2048,
      webDev: 4096,
      webProduction: 8192,
      webGzip: 1024,
    })
    const current = createReport({
      commit: 'head',
      weappDev: 2048,
      weappProduction: 1024,
      webDev: 4096,
      webProduction: 8192,
      webGzip: 2048,
    })

    const markdown = renderRuntimeSizeMarkdown(current, baseline)

    expect(markdown).toContain('| 微信小程序 | 2.00 KiB (+1.00 KiB, +100.00%) | 1.00 KiB (-1.00 KiB, -50.00%) | 不适用 |')
    expect(markdown).toContain('| Web | 4.00 KiB (0 B, 0.00%) | 8.00 KiB (0 B, 0.00%) | 2.00 KiB (+1.00 KiB, +100.00%) |')
    expect(markdown).toContain('完整 runtime provider')
    expect(formatBytes(-1024)).toBe('-1.00 KiB')
  })

  it('creates a versioned PR artifact with exact reports', () => {
    const current = createReport({ commit: 'head', weappDev: 1, weappProduction: 2, webDev: 3, webProduction: 4, webGzip: 2 })
    const baseline = createReport({ commit: 'base', weappDev: 1, weappProduction: 2, webDev: 3, webProduction: 4, webGzip: 2 })
    expect(createRuntimeSizePrArtifact({
      repository: 'owner/repo',
      prNumber: 42,
      headSha: 'head-sha',
      baseSha: 'base-sha',
      current,
      baseline,
    })).toEqual(expect.objectContaining({
      version: 1,
      kind: 'wevu-runtime-size-pr-report',
      repository: 'owner/repo',
      prNumber: 42,
      current,
      baseline,
    }))
  })
})
