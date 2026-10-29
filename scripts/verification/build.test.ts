import type { VerificationTask } from './types.ts'
import { createRequire } from 'node:module'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { expect, it } from 'vitest'
import { createTurboFixture } from '../turboCacheContract/fixture.ts'
import { splitCliBuild, usePreparedTypeChecks } from './build.ts'
import { createVerificationPlan } from './plan.ts'
import { getResourceBudget } from './resources.ts'
import { createTaskExecutor } from './run.ts'
import { readWorkspace } from './workspace.ts'

it('uses the real Turbo graph and builds the CLI exactly once between its dependencies and consumers', async () => {
  const fixture = await createTurboFixture()
  try {
    await fixture.write('packages/weapp-vite/package.json', JSON.stringify({
      name: 'weapp-vite',
      version: '1.0.0',
      dependencies: { '@cache-fixture/library': 'workspace:*' },
      scripts: { 'build': 'node build.mjs', 'test:types:check': 'node check.mjs' },
    }))
    for (const file of ['src/index.js', 'README.md', 'build.mjs', 'check.mjs']) {
      await fixture.write(`packages/weapp-vite/${file}`, await fixture.read(`packages/library/${file}`))
    }
    const consumer = JSON.parse(await fixture.read('mpcore/packages/simulator/package.json')) as { dependencies: Record<string, string> }
    consumer.dependencies = { 'weapp-vite': 'workspace:*' }
    await fixture.write('mpcore/packages/simulator/package.json', JSON.stringify(consumer))
    const original: VerificationTask = {
      id: 'build',
      kind: 'build',
      command: 'pnpm',
      directory: '.',
      dependencies: [],
      reason: 'fixture',
      args: ['exec', 'turbo', 'run', 'build', '--filter=@mpcore/simulator', '--concurrency=1'],
      env: { TURBO_TELEMETRY_DISABLED: '1', TURBO_CACHE: 'local:rw', TURBO_TOKEN: '', TURBO_TEAM: '' },
    }
    const split = await splitCliBuild(fixture.root, original)
    expect(split.tasks.map(task => task.id)).toEqual(['build:layer:0:build', 'dist-sync:weapp-vite', 'build:layer:2:build'])
    expect(split.tasks.filter(task => task.args.includes('weapp-vite'))).toHaveLength(1)
    const executeTask = createTaskExecutor(fixture.root, true)
    const turboEntry = createRequire(import.meta.url).resolve('turbo/bin/turbo')
    // 临时工作区没有安装工具依赖；直接启动仓库已安装的 Turbo，避免 pnpm exec 自动安装改变 fixture。
    const execute = (task: VerificationTask) => {
      expect(task.command).toBe('pnpm')
      if (task.args[0] === 'exec' && task.args[1] === 'turbo') {
        return executeTask({ ...task, command: process.execPath, args: [turboEntry, ...task.args.slice(2)] })
      }
      expect(task.id).toBe('dist-sync:weapp-vite')
      expect(task.args).toEqual(['--filter', 'weapp-vite', 'build'])
      return executeTask({ ...task, command: process.execPath, directory: 'packages/weapp-vite', args: ['build.mjs'] })
    }
    for (const task of split.tasks) {
      if (task.args.includes('turbo')) {
        task.args.push('--summarize')
        task.evidence = 'turbo-summary'
      }
      expect((await execute(task)).exitCode).toBe(0)
    }
    const types = { ...original, id: 'types', kind: 'types' as const, args: ['exec', 'turbo', 'run', 'test:types:check', '--filter=@mpcore/simulator'] }
    await usePreparedTypeChecks(fixture.root, types)
    expect(types.args).toContain('--filter=@cache-fixture/library')
    expect(types.args).toContain('--filter=weapp-vite')
    expect(types.args).toContain('--filter=@mpcore/simulator')
    expect(types.args).toContain('--only')
    expect((await execute(types)).exitCode).toBe(0)
    for (const directory of ['packages/library', 'packages/weapp-vite', 'mpcore/packages/simulator']) {
      expect(await fixture.read(`${directory}/.runs/build`)).toBe('run\n')
      expect(await fixture.read(`${directory}/.runs/check`)).toBe('run\n')
    }
    const executeRound = async () => {
      const round = await splitCliBuild(fixture.root, original)
      const results = []
      for (const task of round.tasks) {
        if (task.args.includes('turbo')) {
          task.args.push('--summarize')
          task.evidence = 'turbo-summary'
        }
        results.push(await execute(task))
      }
      return results
    }
    expect((await executeRound()).map(result => result.execution)).toEqual(['cached', 'actual', 'cached'])
    await fixture.write('packages/library/src/index.js', 'export const changed = true\n')
    expect((await executeRound()).map(result => result.execution)).toEqual(['actual', 'actual', 'actual'])
    expect(await fixture.read('packages/library/.runs/build')).toBe('run\nrun\n')
    expect(await fixture.read('mpcore/packages/simulator/.runs/build')).toBe('run\nrun\n')
    expect(await fixture.read('packages/weapp-vite/.runs/build')).toBe('run\nrun\nrun\n')
  }
  finally {
    await fixture.cleanup()
  }
}, 30_000)

it('inherits real shared and consumer build policies while delegating negative fixtures to runtime owners', async () => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const plan = await createVerificationPlan({
    root,
    packages: await readWorkspace(root),
    resources: getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 }),
    changes: { head: 'fixture', base: 'fixture', fingerprint: 'source', files: ['packages/weapp-vite/src/cli/index.ts'], fallback: false, warnings: [] },
    mode: 'review',
    selection: 'affected',
  })
  const buildFilters = plan.tasks.filter(task => task.kind === 'build').flatMap(task => task.args.filter(arg => arg.startsWith('--filter=')))
  expect(buildFilters).toContain('--filter=vite-native')
  expect(buildFilters).toContain('--filter=weapp-vite-template')
  for (const name of ['e2e-issue-814-tailwind4-broken', 'e2e-app-script-setup-macros-js-with-defaults-invalid', 'fixture-weapp-vite-basic', '@weapp-vite/dimina-playground']) {
    expect(buildFilters).not.toContain(`--filter=${name}`)
  }
  expect(plan.tasks.filter(task => task.id === 'dist-sync:weapp-vite')).toHaveLength(1)
  expect(plan.tasks.find(task => task.id === 'types')?.args).toEqual(expect.arrayContaining(['--only', '--filter=weapp-vite-lib-mode-e2e']))
  expect(plan.warnings.some(warning => warning.includes('正负例'))).toBe(true)
})

it.each([false, true])('keeps cached quick preparation for test-only edits and explicit CLI sync for runtime edits: %s', async (runtimeChanged) => {
  const root = fileURLToPath(new URL('../../', import.meta.url))
  const test = 'packages/weapp-vite/src/runtime/buildPlugin/startupFallbackShutdown.native.test.ts'
  const plan = await createVerificationPlan({
    root,
    packages: await readWorkspace(root),
    resources: getResourceBudget({ cpus: 4, totalMemoryBytes: 16 * 1024 ** 3, freeMemoryBytes: 12 * 1024 ** 3, jobs: 2 }),
    changes: { head: 'fixture', base: 'fixture', fingerprint: 'source', files: runtimeChanged ? [test, 'packages/weapp-vite/src/runtime/buildPlugin/service.ts'] : [test], fallback: false, warnings: [] },
    mode: 'quick',
    selection: 'affected',
  })
  const sync = plan.tasks.filter(task => task.id === 'dist-sync:weapp-vite')
  expect(sync).toHaveLength(runtimeChanged ? 1 : 0)
  if (runtimeChanged) {
    expect(sync[0]?.args).toEqual(['--filter', 'weapp-vite', 'build'])
  }
  else {
    expect(plan.tasks.find(task => task.id === 'build')?.args).toEqual(expect.arrayContaining(['exec', 'turbo', 'run', 'build', '--filter=weapp-vite']))
  }
  const builds = plan.tasks.filter(task => task.kind === 'build').map(task => task.id)
  expect(builds.length).toBeGreaterThan(0)
  for (const id of ['test:weapp-vite', 'typecheck:weapp-vite']) {
    const task = plan.tasks.find(task => task.id === id)
    expect(task?.blockedReason).toBeUndefined()
    expect(task?.dependencies.length).toBeGreaterThan(0)
    expect(task?.dependencies.every(dependency => builds.includes(dependency))).toBe(true)
  }
  expect(plan.tasks.find(task => task.id === 'test:weapp-vite')?.args).toContain('src/runtime/buildPlugin/startupFallbackShutdown.native.test.ts')
  expect(plan.tasks.find(task => task.id === 'typecheck:weapp-vite')?.args).toEqual(['--filter', 'weapp-vite', 'run', 'typecheck'])
})

it('refuses to discard an additional type prerequisite when reusing prepared builds', async () => {
  const fixture = await createTurboFixture()
  try {
    const turbo = JSON.parse(await fixture.read('turbo.json')) as { tasks: Record<string, { dependsOn?: string[] }> }
    turbo.tasks['prepare:types'] = {}
    turbo.tasks['test:types:check']!.dependsOn!.push('prepare:types')
    await fixture.write('turbo.json', JSON.stringify(turbo))
    const manifest = JSON.parse(await fixture.read('packages/library/package.json')) as { scripts: Record<string, string> }
    manifest.scripts['prepare:types'] = 'node --version'
    await fixture.write('packages/library/package.json', JSON.stringify(manifest))
    const original: VerificationTask = {
      id: 'types',
      kind: 'types',
      command: 'pnpm',
      directory: '.',
      dependencies: [],
      reason: 'fixture',
      args: ['exec', 'turbo', 'run', 'test:types:check', '--filter=@cache-fixture/library'],
      env: { TURBO_TELEMETRY_DISABLED: '1' },
    }
    const originalArgs = [...original.args]
    await expect(usePreparedTypeChecks(fixture.root, original)).rejects.toThrow('未准备的前置检查')
    expect(original.args).toEqual(originalArgs)
  }
  finally {
    await fixture.cleanup()
  }
})
