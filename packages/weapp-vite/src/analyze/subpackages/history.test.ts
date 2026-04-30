import type { ConfigService } from '../../runtime/config/types'
import { mkdtemp, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'pathe'
import { afterEach, describe, expect, it } from 'vitest'
import { readLatestAnalyzeHistorySnapshot, writeAnalyzeHistorySnapshot } from './history'
import { createAnalyzeMetadata } from './metadata'
import { createAnalyzeMarkdownReport } from './report'

const tempRoots: string[] = []

async function createTempRoot() {
  const root = await mkdtemp(path.join(tmpdir(), 'weapp-vite-analyze-'))
  tempRoots.push(root)
  return root
}

function createConfigService(root: string, overrides: Record<string, any> = {}): ConfigService {
  return {
    cwd: root,
    relativeCwd: (input: string) => path.relative(root, input) || '.',
    weappViteConfig: {
      analyze: {
        history: {
          dir: '.history',
          limit: 1,
        },
      },
      ...overrides,
    },
  } as ConfigService
}

function createResult(root: string, label = '主包') {
  const configService = createConfigService(root)
  return {
    metadata: createAnalyzeMetadata(configService),
    packages: [
      {
        id: '__main__',
        label,
        type: 'main' as const,
        files: [
          {
            file: 'app.js',
            type: 'chunk' as const,
            from: 'main' as const,
            size: 1024,
            gzipSize: 512,
            brotliSize: 420,
          },
        ],
      },
    ],
    modules: [],
    subPackages: [],
  }
}

describe('analyze history and report', () => {
  afterEach(async () => {
    await Promise.all(tempRoots.splice(0).map(root => rm(root, { recursive: true, force: true })))
  })

  it('writes latest snapshot and trims stale files', async () => {
    const root = await createTempRoot()
    const configService = createConfigService(root)

    await writeAnalyzeHistorySnapshot(createResult(root, 'first'), configService, new Date('2026-01-01T00:00:00.000Z'))
    await writeAnalyzeHistorySnapshot(createResult(root, 'second'), configService, new Date('2026-01-01T00:00:01.000Z'))

    const latest = await readLatestAnalyzeHistorySnapshot(configService)
    expect(latest?.packages[0]?.label).toBe('second')
  })

  it('creates markdown report with previous size delta', async () => {
    const root = await createTempRoot()
    const current = createResult(root, 'current')
    const previous = createResult(root, 'previous')
    previous.packages[0]!.files[0]!.size = 512

    const report = createAnalyzeMarkdownReport(current, previous)

    expect(report).toContain('# weapp-vite analyze 报告')
    expect(report).toContain('较上次：+512 B')
    expect(report).toContain('| current | main | 1.00 KB | 420 B | +512 B | 正常 |')
  })
})
