import assert from 'node:assert/strict'
import { readFile } from 'node:fs/promises'
import { it } from 'vitest'
import { createBenchmarkCheckoutPreparationCommands, createBenchmarkRunnerPreparationCommand, createBenchmarkTemplateDependenciesCommand } from './benchmark-checkout-preparation'

it('prepares selected templates transitive dependencies without building the measurement targets', () => {
  const command = createBenchmarkTemplateDependenciesCommand(['weapp-vite-react-template', 'weapp-vite-template', 'weapp-vite-react-template'])
  const selectors = command.args.filter((_, index, args) => args[index - 1] === '--filter')
  assert.deepEqual(selectors, ['weapp-vite...', 'weapp-vite-react-template^...', 'weapp-vite-template^...'])
  assert.ok(command.args.includes('-r'))
  assert.ok(!selectors.includes('weapp-vite-react-template...'))
  assert.equal(command.command, 'pnpm')
})

it('syncs generated API sources before benchmarking a checkout', () => {
  assert.deepEqual(createBenchmarkCheckoutPreparationCommands(), [
    {
      command: 'pnpm',
      args: ['--filter', '@weapp-core/api', 'catalog:sync'],
    },
    {
      command: 'pnpm',
      args: ['--filter', '@weapp-core/api', 'docs:sync'],
    },
  ])
})

it('prepares public workspace imports used by the runner before the baseline checkout runs', async () => {
  const command = createBenchmarkRunnerPreparationCommand()
  const selectedPackages = new Set(command.args.filter((_, index, args) => args[index - 1] === '--filter'))
  const sources = await Promise.all([
    readFile(new URL('./benchmark-templates-hmr.ts', import.meta.url), 'utf8'),
    readFile(new URL('../e2e/utils/hmr-helpers.ts', import.meta.url), 'utf8'),
  ])
  const requiredPackages = new Set(sources.flatMap(source => Array.from(
    source.matchAll(/from\s+['"](@weapp-core\/[^/'"]+)(?:\/[^'"]*)?['"]/g),
    match => match[1],
  )))
  assert.ok(requiredPackages.size > 0)
  for (const dependency of requiredPackages) {
    assert.ok(selectedPackages.has(dependency!), `Runner dependency ${dependency} has no dist preparation`)
  }
  assert.equal(command.command, 'pnpm')
  assert.equal(command.args.at(-1), 'build')
  assert.ok(!selectedPackages.has('weapp-vite'))
})
