/* eslint-disable e18e/ban-dependencies -- 只核验采集器子进程身份，不启动真实基准。 */
import type { Checkout } from './collect'
import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execa } from 'execa'
import { afterEach, expect, it, vi } from 'vitest'
import { collectAutoImport } from './autoImport'
import { historicalBaselineSha } from './historicalBaseline.mjs'

vi.mock('execa', () => ({ execa: vi.fn() }))
afterEach(() => {
  vi.resetAllMocks()
  vi.unstubAllEnvs()
})

it.each([
  ['baseline', historicalBaselineSha, 'hmr'],
  ['optimized', historicalBaselineSha, 'hmr'],
  ['baseline', 'a'.repeat(40), 'hmr'],
  ['optimized', 'a'.repeat(40), 'hmr'],
  ['baseline', historicalBaselineSha, 'build'],
  ['optimized', historicalBaselineSha, 'build'],
] as const)('freezes measured checkout identity for %s %s auto-%s', async (side, commit, kind) => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'auto-shutdown-'))
  const checkout: Checkout = { id: side, cwd: root, commit, templates: [] }
  vi.stubEnv('WEAPP_VITE_PERF_SHUTDOWN_SIDE', 'baseline')
  vi.stubEnv('WEAPP_VITE_PERF_SHUTDOWN_COMMIT', historicalBaselineSha)
  try {
    vi.mocked(execa).mockImplementationOnce(((_command: string, args: string[], options: { env: Record<string, string> }) => {
      expect(args).toContain(`packages/weapp-vite/scripts/benchmark-auto-import-${kind}.ts`)
      expect(options.env.WEAPP_VITE_PERF_SHUTDOWN_SIDE).toBe(side)
      expect(options.env.WEAPP_VITE_PERF_SHUTDOWN_COMMIT).toBe(commit)
      expect(options.env.AUTO_IMPORT_BENCH_TARGET_ROOT).toBe(root)
      expect(options.env.BENCH_SCENARIOS).toBe('1')
      expect(options.env.BENCH_CONFIGURATIONS).toBe('["1:manual"]')
      return (async () => {
        const raw = { durationMs: 10, repeatDurationMs: 8, cycles: [{ editMs: 2, restoreMs: 3 }, { editMs: 4, restoreMs: 5 }] }
        await writeFile(path.join(root, 'report.json'), JSON.stringify({ results: [{ usedCount: 1, raw: { manual: [raw] } }] }))
        return { exitCode: 0, stdout: '', stderr: '' }
      })()
    }) as never)
    const samples = await collectAutoImport(checkout, root, root, kind, ['1:manual'])
    expect(samples.map(sample => sample.id)).toEqual(kind === 'hmr'
      ? ['auto-hmr:1:manual:first:edit', 'auto-hmr:1:manual:first:restore', 'auto-hmr:1:manual:repeat:edit', 'auto-hmr:1:manual:repeat:restore']
      : ['auto-build:1:manual:first', 'auto-build:1:manual:repeat'])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
