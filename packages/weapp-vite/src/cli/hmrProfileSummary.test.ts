import os from 'node:os'
import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { describe, expect, it } from 'vitest'
import { readLatestHmrProfileSummary } from './hmrProfileSummary'

describe('hmrProfileSummary', () => {
  it('reads latest valid sample and formats concise summary', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-hmr-summary-'))
    const profilePath = path.join(root, '.weapp-vite', 'hmr-profile.jsonl')
    await fs.ensureDir(path.dirname(profilePath))
    await fs.writeFile(profilePath, [
      JSON.stringify({
        totalMs: 80,
        event: 'update',
        file: `${root}/src/pages/home/index.vue`,
        emitMs: 30,
      }),
      '{invalid',
      JSON.stringify({
        totalMs: 120,
        event: 'update',
        file: `${root}/src/pages/logs/index.vue`,
        buildCoreMs: 70,
        buildStartMs: 6,
        pluginResolveMs: 5,
        generateBundleMs: 72,
        coreLoadMs: 76,
        entryLoadMs: 45,
        snapshotBuildMs: 110,
        requestGlobalsMs: 12,
        generateRewriteMs: 18,
        vueTransformMs: 12,
        vueCompileMs: 90,
        watchToDirtyMs: 8,
        emitMs: 60,
        sharedChunkResolveMs: 10,
        chunkEmitCount: 3,
        loadCount: 2,
        resolveCount: 4,
        skippedLoadedCount: 1,
      }),
      '',
    ].join('\n'), 'utf8')

    const result = await readLatestHmrProfileSummary({
      cwd: root,
      relativeCwd: value => value.replace(`${root}/`, ''),
      weappViteConfig: {
        hmr: {
          profileJson: true,
        },
      },
    })

    expect(result?.profilePath).toBe(profilePath)
    expect(result?.line).toContain('最近一次热更新 120.00 ms')
    expect(result?.line).toContain('src/pages/logs/index.vue')
    expect(result?.line).toContain('主耗时 snapshot-build 110.00 ms')
    expect(result?.line).toContain('load/resolve/chunk/skip 2/4/3/1')
  })

  it('ignores failed and incompatible tails and keeps unobserved counts unknown', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'weapp-vite-hmr-summary-'))
    try {
      const profilePath = path.join(root, 'profile.jsonl')
      await fs.writeFile(profilePath, [
        { schemaVersion: 1, status: 'complete', totalMs: 12, loadCount: 0 },
        { schemaVersion: 1, status: 'failed', totalMs: 99 },
        { schemaVersion: 2, status: 'complete', totalMs: 200 },
      ].map(value => JSON.stringify(value)).join('\n'))
      const result = await readLatestHmrProfileSummary({
        cwd: root,
        weappViteConfig: { hmr: { profileJson: 'profile.jsonl' } },
      })
      expect(result?.line).toContain('12.00 ms')
      expect(result?.line).toContain('load/resolve/chunk/skip 0/unknown/unknown/unknown')
      expect(result?.line).toContain('忽略 2 条不兼容、未完成或无效记录')
    }
    finally {
      await fs.remove(root)
    }
  })

  it('returns undefined when profile output is disabled', async () => {
    const result = await readLatestHmrProfileSummary({
      cwd: '/project',
      weappViteConfig: {},
    })

    expect(result).toBeUndefined()
  })
})
