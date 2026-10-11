import { execFileSync } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import process from 'node:process'
import { describe, expect, it } from 'vitest'
import { createBuildPlan } from './build-core-windows-ci.mjs'
import { WINDOWS_TURBO_BUILD_ARGS } from './run-windows-build-ci'

const root = path.resolve(import.meta.dirname, '..')
const manifest = JSON.parse(readFileSync(path.join(root, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
const turbo = createRequire(import.meta.url).resolve('turbo/bin/turbo')
const experiment = '@weapp-vite/dimina-playground'

function selectedPackages(args: string[]) {
  const output = execFileSync(process.execPath, [turbo, ...args, '--dry=json'], {
    cwd: root,
    encoding: 'utf8',
    // 完整 monorepo 的构建计划可能超过 Node 默认的 1 MiB 输出上限。
    maxBuffer: 8 * 1024 * 1024,
  })
  const result = JSON.parse(output) as { tasks: { package: string }[] }
  return result.tasks.map(task => task.package)
}

describe('explicit Dimina build boundary', () => {
  for (const [name, command] of Object.entries(manifest.scripts)) {
    if (!command.startsWith('turbo run') || (!command.includes('build') && name !== 'dev')) {
      continue
    }
    it(`${name} does not schedule the experiment`, () => {
      const args = command.split(' && ')[0]!.split(' ').slice(1)
      const delimiter = args.indexOf('--')
      expect(selectedPackages(delimiter < 0 ? args : args.slice(0, delimiter))).not.toContain(experiment)
    })
  }
  it('excludes the experiment in both Windows build planners', () => {
    expect(selectedPackages(WINDOWS_TURBO_BUILD_ARGS)).not.toContain(experiment)
    expect(createBuildPlan().map((entry: { name: string }) => entry.name)).not.toContain(experiment)
  })
  it('still allows an explicitly selected build', () => {
    expect(selectedPackages(['run', 'build', `--filter=${experiment}`])).toContain(experiment)
  })
})
