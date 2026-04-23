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
        watchToDirtyMs: 8,
        emitMs: 60,
        sharedChunkResolveMs: 10,
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
    expect(result?.line).toContain('主耗时 emit 60.00 ms')
  })

  it('returns undefined when profile output is disabled', async () => {
    const result = await readLatestHmrProfileSummary({
      cwd: '/project',
      weappViteConfig: {},
    })

    expect(result).toBeUndefined()
  })
})
