import { describe, expect, it } from 'vitest'
import { confirmationConfigurations, createMatrix, metricsForShard, needsSmoke, policy, shards, targetKey } from './contract.mjs'

it('freezes 150 metrics into nine disjoint shards on all three OSes', () => {
  const metrics = shards.flatMap(metricsForShard)
  expect(shards).toHaveLength(9)
  expect(metrics).toHaveLength(150)
  expect(new Set(metrics).size).toBe(150)
  expect(createMatrix([{ id: 'main', headSha: 'a'.repeat(40), baselineSha: policy.baselineSha }])).toHaveLength(27)
})

it('selects configuration ownership without dropping lifecycle phases', () => {
  expect(confirmationConfigurations(['auto-hmr:20:automatic:first:restore', 'auto-hmr:20:automatic:repeat:edit'])).toEqual(['auto-hmr:20:automatic'])
  expect(confirmationConfigurations(['hmr:classic:weapp-vite-template:native-page-style:first:restore'])).toEqual(['hmr:classic:weapp-vite-template'])
})

it('deduplicates a SHA independently of PR labels, driver SHA and previous verdict', () => {
  const target = { headSha: 'a'.repeat(40), baselineSha: policy.baselineSha }
  expect(targetKey(target)).toBe(targetKey({ ...target, prNumber: 8, driverSha: 'b'.repeat(40), status: 'failure' }))
  expect(targetKey(target)).not.toBe(targetKey({ ...target, headSha: 'b'.repeat(40) }))
  expect(() => targetKey({ ...target, headSha: 'main' })).toThrow()
})

describe('smoke path routing', () => {
  it('skips documentation but includes code, dependencies, fixtures and CI', () => {
    expect(needsSmoke(['README.md', 'docs/reports/result.json', 'website/pages/about.md'])).toBe(false)
    for (const file of ['packages/weapp-vite/src/index.ts', 'templates/native/app.json', 'scripts/performanceGate/policy.json', 'pnpm-lock.yaml', '.github/workflows/ci-performance.yml']) {
      expect(needsSmoke([file])).toBe(true)
    }
  })
})

it('rejects a smoke report with a statistical verdict, missing restore or mismatched output evidence', async () => {
  const { smokeMetrics } = await import('./contract.mjs')
  const { verifySmoke } = await import('./smokeReport.mjs')
  const headSha = 'a'.repeat(40)
  const report = {
    schemaVersion: 2,
    purpose: 'smoke',
    headSha,
    driverSha: headSha,
    baselineSha: policy.baselineSha,
    samplingContract: policy.samplingContract,
    status: 'passed',
    fullAcceptance: 'not-run',
    errors: [],
    executionPlan: { headOnly: true, metrics: shards.flatMap(smokeMetrics), confirmation: [] },
    stages: shards.map(shard => ({ shard, values: smokeMetrics(shard).map((id: string) => ({ id, ms: 100, output: { pageCount: 1, configDigest: 'a'.repeat(64), templateDigest: 'b'.repeat(64) } })) })),
  }
  expect(() => verifySmoke(report, headSha)).not.toThrow()
  expect(() => verifySmoke({ ...report, gate: { status: 'passed' } }, headSha)).toThrow('conclusion')
  report.stages.at(-1)!.values.pop()
  expect(() => verifySmoke(report, headSha)).toThrow('lifecycle')
})
