import process from 'node:process'
import { expect, it } from 'vitest'
import { coverageIdentity, hash, normalizeInventory, verifyCoverageShards } from './contracts.mjs'

it('requires every project/file once and rejects incomplete, duplicated or failed shard evidence', () => {
  const identity = { commit: 'a'.repeat(40), nodeVersion: process.version, packageManager: 'pnpm@11.0.0' }
  const inventory = Array.from({ length: 4 }, (_, index) => ({ projectName: `project-${index}`, file: 'shared.test.ts' }))
  const data = { schemaVersion: 1, identity, shards: 4, inventory }
  const plan = { ...data, planHash: hash(JSON.stringify(data)) }
  const reports = inventory.map((entry, index) => ({ schemaVersion: 1, identity, planHash: plan.planHash, index: index + 1, status: 'passed', inventory: [entry], durationMs: 0 }))
  expect(() => verifyCoverageShards(plan, reports, identity)).not.toThrow()
  expect(() => verifyCoverageShards(plan, reports.slice(1), identity)).toThrow('Missing')
  expect(() => verifyCoverageShards(plan, [...reports.slice(1), reports[1]], identity)).toThrow('Duplicate')
  expect(() => verifyCoverageShards(plan, reports.map((report, index) => index ? report : { ...report, status: 'failed' }), identity)).toThrow('Failed')
  expect(() => verifyCoverageShards(plan, reports.map((report, index) => index ? report : { ...report, inventory: [] }), identity)).toThrow('incomplete')
  expect(() => verifyCoverageShards(plan, reports, { commit: 'b'.repeat(40) })).toThrow('identity')
  expect(() => verifyCoverageShards({ ...plan, shards: 3 }, reports, identity)).toThrow('digest')
  for (const durationMs of [undefined, -1, Number.NaN, Number.POSITIVE_INFINITY]) {
    expect(() => verifyCoverageShards(plan, reports.map((report, index) => index ? report : { ...report, durationMs }), identity)).toThrow('duration')
  }
  for (const changed of [{ nodeVersion: 'v24.0.1' }, { packageManager: 'pnpm@11.0.1' }]) {
    expect(() => verifyCoverageShards(plan, reports, { ...identity, ...changed })).toThrow('identity')
  }
})

it('records actual full Node and resolved pnpm versions rather than only their major or package declaration', async () => {
  const execute = async (command, args, options) => {
    expect([command, args, options.cwd]).toEqual(['pnpm', ['--version'], process.cwd()])
    return { stdout: '11.0.7\n' }
  }
  expect(await coverageIdentity(process.cwd(), 'a'.repeat(40), execute)).toMatchObject({ nodeVersion: process.version, packageManager: 'pnpm@11.0.7' })
  await expect(coverageIdentity(process.cwd(), 'a'.repeat(40), async () => ({ stdout: 'declared' }))).rejects.toThrow('actual pnpm')
})

it('rejects paths outside the repository while retaining project ownership', () => {
  expect(normalizeInventory([{ file: 'src/a.test.ts', projectName: 'a' }], process.cwd())).toEqual([{ file: 'src/a.test.ts', projectName: 'a' }])
  expect(() => normalizeInventory([{ file: '../escaped.test.ts' }], process.cwd())).toThrow('escaped')
})
