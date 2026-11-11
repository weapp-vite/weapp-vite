import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
// eslint-disable-next-line e18e/ban-dependencies -- 跨平台启动真实 Turbo CLI，并在测试取消时终止子进程。
import { execa } from 'execa'
import { describe, expect, it } from 'vitest'
import { createBuildPlan } from './build-core-windows-ci.mjs'
import { WINDOWS_TURBO_BUILD_ARGS } from './run-windows-build-ci'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const turbo = createRequire(import.meta.url).resolve('turbo/bin/turbo')
const experiment = '@weapp-vite/dimina-playground'
const planTimeoutMs = 10_000
// CLI 先按自身时限终止；外层为取消收尾和解析构建计划保留预算。
const testTimeoutMs = planTimeoutMs + 5_000

async function selectedPackages(args: string[], signal: AbortSignal) {
  signal.throwIfAborted()
  const { stdout } = await execa(process.execPath, [turbo, ...args, '--dry=json'], {
    cwd: root,
    cancelSignal: signal,
    timeout: planTimeoutMs,
    forceKillAfterDelay: 1_000,
    // 完整 monorepo 的构建计划可能超过 Node 默认的 1 MiB 输出上限。
    maxBuffer: 8 * 1024 * 1024,
  })
  const result = JSON.parse(stdout) as { tasks: { package: string }[] }
  return result.tasks.map(task => task.package)
}

describe('explicit Dimina build boundary', () => {
  for (const [name, command] of Object.entries(manifest.scripts)) {
    if (!command.startsWith('turbo run') || (!command.includes('build') && name !== 'dev')) {
      continue
    }
    it(`${name} does not schedule the experiment`, async ({ signal }) => {
      const args = command.split(' && ')[0]!.split(' ').slice(1)
      const delimiter = args.indexOf('--')
      expect(await selectedPackages(delimiter < 0 ? args : args.slice(0, delimiter), signal)).not.toContain(experiment)
    }, testTimeoutMs)
  }
  it('excludes the experiment in both Windows build planners', async ({ signal }) => {
    expect(await selectedPackages(WINDOWS_TURBO_BUILD_ARGS, signal)).not.toContain(experiment)
    expect(createBuildPlan().map((entry: { name: string }) => entry.name)).not.toContain(experiment)
  }, testTimeoutMs)
  it('still allows an explicitly selected build', async ({ signal }) => {
    expect(await selectedPackages(['run', 'build', `--filter=${experiment}`], signal)).toContain(experiment)
  }, testTimeoutMs)
})
