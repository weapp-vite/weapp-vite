import { expect, it } from 'vitest'
import { parseViteContractCases, runViteContractCases, viteContractCases } from './runner.mjs'

it('keeps every upstream Vite diagnostic in the default inventory and supports explicit diagnostic cases', () => {
  expect(parseViteContractCases([])).toEqual(['hooks', 'resolver', 'optimizer', 'optimizer-cancel', 'optimizer-server', 'polling'])
  expect(parseViteContractCases(['--case', 'resolver', '--case=optimizer-cancel', '--case=resolver'])).toEqual(['resolver', 'optimizer-cancel'])
  for (const args of [['--case'], ['--case='], ['--case=missing'], ['--skip']]) {
    expect(() => parseViteContractCases(args)).toThrow('Unknown Vite contract case:')
  }
})

it('runs selected entries in sequence and propagates failures before later entries', async () => {
  const entered: string[] = []
  const failure = new Error('upstream contract failed')
  const contracts = Object.fromEntries(viteContractCases.map(name => [name, async () => {
    entered.push(name)
    await Promise.resolve()
    return [`${name}-check`]
  }]))
  expect(await runViteContractCases(['resolver', 'optimizer-cancel'], contracts)).toEqual(['resolver-check', 'optimizer-cancel-check'])
  expect(entered).toEqual(['resolver', 'optimizer-cancel'])
  entered.length = 0
  contracts.resolver = async () => {
    entered.push('resolver')
    throw failure
  }
  await expect(runViteContractCases(parseViteContractCases([]), contracts)).rejects.toBe(failure)
  expect(entered).toEqual(['hooks', 'resolver'])
})
