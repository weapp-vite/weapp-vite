import assert from 'node:assert/strict'
import { it } from 'vitest'
import { createBenchmarkCheckoutPreparationCommands } from './benchmark-checkout-preparation'

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
