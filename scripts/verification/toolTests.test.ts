import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { glob } from 'tinyglobby'
import { expect, it } from 'vitest'
import { parseCLI } from 'vitest/node'
import { ROOT_REPOSITORY_TEST_GLOBS, scriptTestInventory } from './toolTests'

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

it('classifies the real Vite product contract without removing root or coverage discovery', async () => {
  const cwd = path.resolve(import.meta.dirname, '../..')
  const managed = 'scripts/dependencyContracts/vite.test.ts'
  const inventory = await scriptTestInventory(cwd)
  expect(inventory.managed).toEqual(new Set([managed]))
  expect(inventory.all).toContain(managed)
  expect(inventory.root.has(managed)).toBe(true)

  const manifest = JSON.parse(await readFile(path.join(cwd, 'package.json'), 'utf8')) as { scripts: Record<string, string> }
  const configuration = await readFile(path.join(cwd, 'vitest.config.mts'), 'utf8')
  expect(configuration).toContain('include: ROOT_REPOSITORY_TEST_GLOBS')
  for (const script of ['test', 'test:coverage']) {
    const { filter, options } = parseCLI(manifest.scripts[script]!)
    expect(filter).toEqual([])
    expect(await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd, ignore: options.exclude })).toContain(managed)
  }

  const support = 'packages/weapp-vite/scripts/viteProductContracts/support.test.ts'
  expect(inventory.all).not.toContain(support)
  expect(await glob(ROOT_REPOSITORY_TEST_GLOBS, { cwd })).not.toContain(support)
  const packageConfiguration = await readFile(path.join(cwd, 'packages/weapp-vite/vitest.config.ts'), 'utf8')
  expect(packageConfiguration).toContain('scripts/**/*.test.ts')
  expect(await glob('scripts/**/*.test.ts', { cwd: path.join(cwd, 'packages/weapp-vite') })).toContain('scripts/viteProductContracts/support.test.ts')
})
