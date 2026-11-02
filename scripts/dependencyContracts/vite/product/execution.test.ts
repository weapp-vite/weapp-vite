import { beforeEach, expect, it, vi } from 'vitest'
import { verifyViteProductAcceptance, verifyViteProductContracts } from '../../../../packages/weapp-vite/scripts/viteProductContracts/index'
import { viteProductContractNames, viteRequiredContractNames } from './inventory.mjs'

const cases = vi.hoisted(() => Object.fromEntries(['hooks', 'resolver', 'miniOptimizer', 'webOptimizer', 'polling', 'ready'].map(name => [name, vi.fn(async () => ({ observed: name }))])))
vi.mock('../../../../packages/weapp-vite/scripts/viteProductContracts/build', () => ({ hooks: cases.hooks, resolver: cases.resolver }))
vi.mock('../../../../packages/weapp-vite/scripts/viteProductContracts/lifecycle', () => ({ miniOptimizer: cases.miniOptimizer, webOptimizer: cases.webOptimizer }))
vi.mock('../../../../packages/weapp-vite/scripts/viteProductContracts/watch', () => ({ polling: cases.polling, ready: cases.ready }))

beforeEach(() => vi.resetAllMocks())

it('executes the fixed five-case acceptance plan without executing or reporting Web success', async () => {
  const complete = vi.fn()
  const start = vi.fn()
  const results = await verifyViteProductAcceptance(complete, start)
  expect(results.map(item => item.name)).toEqual(viteRequiredContractNames)
  expect(start.mock.calls.map(([name]) => name)).toEqual(viteRequiredContractNames)
  expect(complete.mock.calls.map(([result]) => result)).toEqual(results)
  expect(cases.webOptimizer).not.toHaveBeenCalled()
})

it.each(['hooks', 'resolver', 'miniOptimizer', 'polling', 'ready'])('preserves the original %s error and stops later acceptance cases', async (name) => {
  const original = new Error(`${name} original failure`)
  cases[name]!.mockRejectedValueOnce(original)
  const complete = vi.fn()
  await expect(verifyViteProductAcceptance(complete)).rejects.toBe(original)
  expect(complete).toHaveBeenCalledTimes(['hooks', 'resolver', 'miniOptimizer', 'polling', 'ready'].indexOf(name))
})

it('keeps the full public diagnostic strict and executes the original Web assertion', async () => {
  const original = new Error('scanner cache remained')
  cases.webOptimizer!.mockRejectedValueOnce(original)
  const complete = vi.fn()
  await expect(verifyViteProductContracts(complete)).rejects.toBe(original)
  expect(complete.mock.calls.map(([result]) => result.name)).toEqual(viteProductContractNames.slice(0, 3))
  expect(cases.polling).not.toHaveBeenCalled()
  expect(cases.ready).not.toHaveBeenCalled()
})
