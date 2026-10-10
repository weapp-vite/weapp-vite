import { afterEach, describe, expect, it } from 'vitest'
import { createTurboFixture, planRepositoryTypeChecks } from './turboCacheContract/fixture'

const fixtures: Awaited<ReturnType<typeof createTurboFixture>>[] = []

afterEach(async () => {
  await Promise.all(fixtures.splice(0).map(fixture => fixture.cleanup()))
})

async function fixture() {
  const created = await createTurboFixture()
  fixtures.push(created)
  return created
}

describe('Turbo release cache contract', () => {
  it('selects every package type contract without expanding release builds into apps or templates', async () => {
    const { expectedChecks, typeTasks, releaseTasks } = await planRepositoryTypeChecks()
    const checks = typeTasks.filter(task => task.task === 'test:types:check' && task.command !== '<NONEXISTENT>')
    expect(expectedChecks.length).toBeGreaterThan(0)
    expect(checks.map(task => task.taskId).sort()).toEqual(expectedChecks.sort())
    for (const task of checks) {
      expect(task.resolvedTaskDefinition.cache, task.taskId).toBe(false)
      expect(task.dependencies, task.taskId).toContain(task.taskId.replace(/#test:types:check$/, '#build'))
    }
    const tasksById = new Map(typeTasks.map(task => [task.taskId, task]))
    const requiredTasks = new Set<string>()
    function includeDependencies(taskId: string) {
      if (requiredTasks.has(taskId)) {
        return
      }
      requiredTasks.add(taskId)
      for (const dependency of tasksById.get(taskId)?.dependencies ?? []) {
        includeDependencies(dependency)
      }
    }
    for (const task of checks) {
      includeDependencies(task.taskId)
    }
    const unnecessaryUncachedBuilds = typeTasks.filter(task => task.task === 'build'
      && !task.resolvedTaskDefinition.cache
      && !requiredTasks.has(task.taskId)).map(task => task.taskId)
    expect(unnecessaryUncachedBuilds, 'Dashboard must not rebuild solely because it was selected as a type-check transit task').toEqual([])
    const releaseBuilds = new Set(releaseTasks.filter(task => task.task === 'build').map(task => task.taskId))
    for (const task of typeTasks) {
      expect(task.directory.replaceAll('\\', '/'), task.taskId).toMatch(/^(?:packages|packages-runtime|mpcore\/packages|@weapp-core)\//)
      if (task.task === 'build') {
        expect(releaseBuilds.has(task.taskId), task.taskId).toBe(true)
      }
    }
  }, 60_000)

  it('invalidates builds for package inputs outside src and never treats tracked launchers as outputs', async () => {
    const project = await fixture()
    const baseline = await project.plan('build')
    expect(baseline.resolvedTaskDefinition.outputs).toEqual(['dist/**'])

    for (const file of ['README.md', 'build.mjs', 'bin/cli.js', 'docs/guide.md', 'client.d.ts', 'entry.ts', 'vite.shared.ts', 'vitest.config.mts']) {
      const relative = `packages/library/${file}`
      const original = await project.read(relative)
      await project.write(relative, `${original}\nchanged\n`)
      expect((await project.plan('build')).hash, file).not.toBe(baseline.hash)
      await project.write(relative, original)
    }
  }, 60_000)

  it('invalidates cached tasks for shared configuration and the actual toolchain identity', async () => {
    const project = await fixture()
    const baseline = await project.plan('build')
    for (const file of [
      'tsconfig.json',
      'tsconfig.base.json',
      '.npmrc',
      'scripts/vite/vueOxcTsconfigGuard.ts',
      'e2e-apps/shared/appLifecycle/observer.ts',
      'e2e/utils/requestClientsRealHostTraceRuntime.ts',
      'e2e/utils/requestClientsRealWebSocketProbe.ts',
      'patches/fixture.patch',
    ]) {
      const original = await project.read(file)
      await project.write(file, `${original}\n`)
      expect((await project.plan('build')).hash, file).not.toBe(baseline.hash)
      await project.write(file, original)
    }
    for (const name of ['CI', 'NODE_ENV', 'REPOCTL_RELEASE_NODE_VERSION', 'REPOCTL_RELEASE_PNPM_VERSION', 'REPOCTL_RELEASE_PLATFORM', 'REPOCTL_RELEASE_ARCH']) {
      expect((await project.plan('build', undefined, { [name]: 'different' })).hash, name).not.toBe(baseline.hash)
    }
  }, 60_000)

  it('invalidates lint for root rules and package files that ESLint reads', async () => {
    const project = await fixture()
    const baseline = await project.plan('lint')
    for (const file of ['eslint.config.js', 'stylelint.config.js', 'packages/eslint/src/runtimeReceiver.ts', 'packages/library/README.md', 'packages/library/test-d/public.test-d.ts']) {
      const original = await project.read(file)
      await project.write(file, `${original}\nchanged\n`)
      expect((await project.plan('lint')).hash, file).not.toBe(baseline.hash)
      await project.write(file, original)
    }
  }, 60_000)

  it('restores dist from cache without overwriting tracked launchers or reexecuting the build', async () => {
    const project = await fixture()
    await project.run('build')
    const artifact = await project.read('packages/library/dist/result.json')
    await project.remove('packages/library/dist')
    await project.run('build')
    expect(await project.read('packages/library/dist/result.json')).toBe(artifact)
    expect(await project.read('packages/library/.runs/build')).toBe('run\n')

    await project.write('packages/library/bin/cli.js', 'updated launcher\n')
    await project.run('build')
    expect(await project.read('packages/library/bin/cli.js')).toBe('updated launcher\n')
    expect(await project.read('packages/library/.runs/build')).toBe('run\nrun\n')
  }, 60_000)

  it('restores generated Agent skills and invalidates them for the source skill or synchronizer', async () => {
    const project = await fixture()
    const name = '@weapp-agent/cli'
    const baseline = await project.plan('build', name)
    expect(baseline.resolvedTaskDefinition.outputs).toContain('skills/**')
    await project.run('build', name)
    await project.remove('packages/agent-cli/dist')
    await project.remove('packages/agent-cli/skills')
    await project.run('build', name)
    expect(await project.read('packages/agent-cli/skills/weapp-acceptance/SKILL.md')).toBe('# Acceptance\n')
    expect(await project.read('packages/agent-cli/.runs/build')).toBe('run\n')
    for (const file of ['skills/weapp-acceptance/SKILL.md', 'scripts/weapp-agent/sync-skill.mjs']) {
      const original = await project.read(file)
      await project.write(file, `${original}\nchanged\n`)
      expect((await project.plan('build', name)).hash, file).not.toBe(baseline.hash)
      await project.write(file, original)
    }
  }, 60_000)

  it('generates or restores Agent skills before lint and invalidates lint when the source skill changes', async () => {
    const project = await fixture()
    const name = '@weapp-agent/cli'
    const planned = await project.plan('lint', name)
    expect(planned.dependencies).toContain('@weapp-agent/cli#build')
    await project.run('lint', name)
    await project.remove('packages/agent-cli/dist')
    await project.remove('packages/agent-cli/skills')
    await project.run('lint', name)
    expect(await project.read('packages/agent-cli/skills/weapp-acceptance/SKILL.md')).toBe('# Acceptance\n')
    expect(await project.read('packages/agent-cli/.runs/lint')).toBe('run\n')
    await project.write('skills/weapp-acceptance/SKILL.md', '# Updated acceptance\n')
    expect((await project.plan('lint', name)).hash).not.toBe(planned.hash)
    await project.run('lint', name)
    expect(await project.read('packages/agent-cli/skills/weapp-acceptance/SKILL.md')).toBe('# Updated acceptance\n')
    expect(await project.read('packages/agent-cli/.runs/lint')).toBe('run\nrun\n')
  }, 60_000)

  it.each(['create-weapp-vite', '@weapp-core/init'])('retains %s version inputs outside its declared dependency graph', async (name) => {
    const project = await fixture()
    const baseline = await project.plan('build', name)
    const file = 'packages/weapp-vite/package.json'
    await project.write(file, '{"version":"2.0.0"}\n')
    expect((await project.plan('build', name)).hash).not.toBe(baseline.hash)
  })

  it('invalidates automator bundles for changes to the simulator source and dependencies it bundles', async () => {
    const project = await fixture()
    const name = '@weapp-vite/miniprogram-automator'
    const baseline = await project.plan('build', name)
    expect(baseline.dependencies).toContain('@mpcore/simulator#build')
    const source = 'mpcore/packages/simulator/src/index.js'
    const original = await project.read(source)
    await project.write(source, 'export const value = "updated simulator"\n')
    expect((await project.plan('build', name)).hash).not.toBe(baseline.hash)
    await project.write(source, original)
    await project.write('packages/library/src/index.js', 'export const value = "updated simulator dependency"\n')
    expect((await project.plan('build', name)).hash).not.toBe(baseline.hash)
  })

  it('runs non-hermetic checks every time while restoring their required build artifacts', async () => {
    const project = await fixture()
    for (const task of ['test', 'typecheck', 'test:types', 'test:types:check']) {
      expect((await project.plan(task)).resolvedTaskDefinition.cache, task).toBe(false)
    }
    expect((await project.plan('test:types:check')).dependencies).toContain('@cache-fixture/library#build')
    await project.run('test:types:check')
    await project.remove('packages/library/dist')
    await project.run('test:types:check')
    expect(await project.read('packages/library/.runs/build')).toBe('run\n')
    expect(await project.read('packages/library/.runs/check')).toBe('run\nrun\n')
  }, 60_000)

  it('always rebuilds Dashboard without restoring its tracked generated declarations', async () => {
    const project = await fixture()
    const name = '@weapp-vite/dashboard'
    const planned = await project.plan('build', name)
    expect(planned.resolvedTaskDefinition.cache).toBe(false)
    expect(planned.resolvedTaskDefinition.outputs).not.toContain('typed-router.d.ts')
    await project.run('build', name)
    await project.run('build', name)
    expect(await project.read('packages/dashboard/.runs/build')).toBe('run\nrun\n')
  }, 60_000)
})
