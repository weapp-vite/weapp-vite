import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'tinyglobby'
import { loadConfigFromFile } from 'vite'
import { expect, it } from 'vitest'
import { parseCLI } from 'vitest/node'
import { REPOSITORY_SUBPROCESS_TEST_FILES, ROOT_REPOSITORY_TEST_GLOBS, scriptTestInventory } from './toolTests'

it('assigns every root contract once while isolating real subprocess tests with their original budget', async () => {
  const cwd = path.resolve(import.meta.dirname, '../..')
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.join(cwd, 'vitest.config.mts'))
  interface Project {
    extends?: boolean
    oxc?: { tsconfig: boolean }
    plugins?: Array<{ name: string }>
    test: {
      name: string
      include: string[]
      exclude: string[]
      setupFiles: string[]
      hookTimeout: number
      testTimeout?: number
      maxWorkers?: number
      fileParallelism?: boolean
      sequence?: { groupOrder: number }
    }
  }
  const config = loaded!.config as { test: { projects: Array<Project | string>, testTimeout?: number } }
  const projects = config.test.projects.filter((project): project is Project => typeof project !== 'string')
  const ordinary = projects.find(project => project.test.name === 'repo-scripts')!
  const subprocess = projects.find(project => project.test.name === 'repo-scripts-subprocess')!
  const discovered = await Promise.all([ordinary, subprocess].map(project => glob(project.test.include, { cwd, ignore: project.test.exclude })))
  const expected = await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd, ignore: ['**/node_modules/**', '**/.git/**'] })
  expect(discovered.flat().sort()).toEqual(expected.sort())
  expect(new Set(discovered.flat()).size).toBe(expected.length)
  expect(discovered[1]!.sort()).toEqual([...REPOSITORY_SUBPROCESS_TEST_FILES].sort())
  expect(discovered[1]).toEqual([
    'scripts/verification/build.test.ts',
    'scripts/verifyVitePlusTemplates/publicTypes.test.ts',
  ])
  expect(subprocess.test).toMatchObject({ sequence: { groupOrder: 200 }, maxWorkers: 1, fileParallelism: false })
  expect(projects.filter(project => project.test.sequence?.groupOrder === 200)).toEqual([subprocess])
  const infrastructure = projects.find(project => project.test.name === 'e2e-hmr-infra')!
  expect(infrastructure.test).toMatchObject({ sequence: { groupOrder: 300 }, maxWorkers: 1, fileParallelism: false, testTimeout: 60_000 })
  expect(projects.filter(project => project.test.sequence?.groupOrder === 300)).toEqual([infrastructure])
  expect(subprocess.test.setupFiles).toEqual(ordinary.test.setupFiles)
  expect(subprocess.test.setupFiles).toEqual([path.join(cwd, 'e2e/vitest.e2e.dev-process.setup.ts')])
  expect(subprocess.test.hookTimeout).toBe(ordinary.test.hookTimeout)
  for (const project of [ordinary, subprocess]) {
    expect(project.extends).toBe(false)
    expect(project.oxc).toEqual({ tsconfig: false })
    expect(project.plugins?.map(plugin => plugin.name)).toContain('repo-scripts:published-node-conditions')
    expect(project.test.testTimeout ?? config.test.testTimeout ?? 5000).toBe(5000)
  }
})

it('serializes the standalone infrastructure entry without losing any discovered contract', async () => {
  const cwd = path.resolve(import.meta.dirname, '../..')
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.join(cwd, 'e2e/vitest.e2e.internal.config.ts'))
  const config = loaded!.config as { test: { include: string[], exclude?: string[], maxWorkers?: number, fileParallelism?: boolean } }
  expect(config.test).toMatchObject({ maxWorkers: 1, fileParallelism: false })
  const actual = await glob(config.test.include, { cwd, ignore: config.test.exclude })
  const expected = await glob(['e2e/ide/runtimeErrors.test.ts', 'e2e/scripts/**/*.test.ts', 'e2e/utils/**/*.test.ts'], { cwd })
  const relative = actual.map(file => path.relative(cwd, path.resolve(cwd, file)).replaceAll('\\', '/'))
  expect(relative.sort()).toEqual(expected.sort())
  expect(new Set(relative).size).toBe(expected.length)
})

it('discovers every shared Tailwind contract in the root project, including nested helpers', async () => {
  const cwd = path.resolve(import.meta.dirname, '../..')
  const expected = await glob('integrations/shared-hmr-tailwind/**/*.test.ts', { cwd })
  const discovered = await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd })
  expect(expected).toContain('integrations/shared-hmr-tailwind/hostDependencies.test.ts')
  expect(expected).toContain('integrations/shared-hmr-tailwind/test/parseLock.test.ts')
  expect(discovered.filter(file => file.startsWith('integrations/shared-hmr-tailwind/')).sort()).toEqual(expected.sort())
})

it('keeps root-only integration contracts out of the supplemental script partition', async () => {
  const cwd = path.resolve(import.meta.dirname, '../..')
  const inventory = await scriptTestInventory(cwd)
  const discovered = new Set(await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd }))
  expect(inventory.all.some(file => file.startsWith('integrations/'))).toBe(false)
  expect([...inventory.root].every(file => discovered.has(file))).toBe(true)
})

it('keeps formal template source acceptance in the dedicated coverage entry while preserving fast contract discovery', async () => {
  const cwd = path.resolve(import.meta.dirname, '../..')
  const sourceAcceptance = 'scripts/templateCorpus/test/sourceCoverage.coverage.ts'
  const inventory = await scriptTestInventory(cwd)
  expect(inventory.all).not.toContain(sourceAcceptance)
  expect(await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd })).not.toContain(sourceAcceptance)
  expect(inventory.all).toContain('scripts/templateCorpus/test/fuzz.test.ts')
  expect(inventory.all).toContain('scripts/templateCorpus/test/coverage.test.ts')

  const packageRoot = path.join(cwd, 'packages/wxml')
  const loaded = await loadConfigFromFile({ command: 'serve', mode: 'test' }, path.join(packageRoot, 'vitest.coverage.config.ts'))
  const config = loaded!.config as { root: string, test: { include: string[], coverage: { include: string[], thresholds: Record<string, number> } } }
  const included = await glob(config.test.include, { cwd: config.root })
  expect(included.map(file => path.relative(cwd, path.resolve(config.root, file)).replaceAll('\\', '/'))).toContain(sourceAcceptance)
  expect(config.test.coverage.include).toEqual(['src/**/*.ts'])
  expect(config.test.coverage.thresholds).toEqual({ statements: 100, functions: 100, lines: 100, branches: 99 })

  const manifest = JSON.parse(await readFile(path.join(packageRoot, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  expect(manifest.scripts['test:coverage']).toBe('node --import tsx ../../scripts/templateCorpus/coverage/run.ts')
})

it('classifies real Vite and benchmark shutdown contracts without removing root or coverage discovery', async () => {
  const cwd = path.resolve(import.meta.dirname, '../..')
  const managed = ['scripts/dependencyContracts/vite.test.ts', 'scripts/performanceGate/devShutdown.integration.test.ts']
  const inventory = await scriptTestInventory(cwd)
  expect(inventory.managed).toEqual(new Set(managed))
  for (const file of managed) {
    expect(inventory.all).toContain(file)
    expect(inventory.root.has(file)).toBe(true)
  }

  const manifest = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  const configuration = await readFile(path.join(cwd, 'vitest.config.mts'), 'utf8')
  expect(configuration).toContain('include: ROOT_REPOSITORY_TEST_GLOBS')
  for (const script of ['test', 'test:coverage']) {
    const { filter, options } = parseCLI(manifest.scripts[script]!)
    expect(filter).toEqual([])
    const discovered = await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd, ignore: options.exclude })
    for (const file of managed) {
      expect(discovered).toContain(file)
    }
  }

  const support = 'packages/weapp-vite/scripts/viteProductContracts/support.test.ts'
  expect(inventory.all).not.toContain(support)
  expect(await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd })).not.toContain(support)
  const packageConfiguration = await readFile(path.join(cwd, 'packages/weapp-vite/vitest.config.ts'), 'utf8')
  expect(packageConfiguration).toContain('scripts/**/*.test.ts')
  expect(await glob('scripts/**/*.test.ts', { cwd: path.join(cwd, 'packages/weapp-vite') })).toContain('scripts/viteProductContracts/support.test.ts')
})
