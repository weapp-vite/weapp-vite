import process from 'node:process'
import { fileURLToPath } from 'node:url'
// eslint-disable-next-line e18e/ban-dependencies -- 独立 GC 契约复用跨平台子进程超时与错误传播。
import { execa } from 'execa'
import { expect, it } from 'vitest'

it('preserves installed Vite hook, resolver and optimizer ownership contracts', async () => {
  // GC 和 WeakRef 观察只在同一个独立子进程中串行运行，不改变其他 Vitest worker。
  const script = fileURLToPath(new URL('./vite/run.mjs', import.meta.url))
  const { stdout } = await execa(process.execPath, ['--expose-gc', script], { timeout: 30_000 })
  const report = JSON.parse(stdout) as { status: string, vite: string, sha256: string, checks: string[] }
  expect(report.status).toBe('passed')
  expect(report.vite).not.toBe('')
  expect(report.sha256).toMatch(/^[a-f0-9]{64}$/)
  expect(report.checks).toEqual([
    'hook-metadata',
    'failed-broadcast',
    'reentrant-broadcast',
    'hook-release',
    'readonly-after-gc',
    'accessor-release',
    'imports-conditions',
    'dynamic-options',
    'late-callback',
    'resolver-logging',
    'optimizer-scan-close',
    'optimizer-init-close',
    'optimizer-publication-close',
    'optimizer-crawl-close',
    'optimizer-native-cancel',
    'optimizer-server-scan-close',
  ])
}, 40_000)
