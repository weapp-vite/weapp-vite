import path from 'node:path'
import { glob } from 'tinyglobby'
import { expect, it } from 'vitest'
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
