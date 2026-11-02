import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it } from 'vitest'
import { aggregatePlan, renderTarget, verifyShard } from './aggregate.mjs'
import { fixture, plan } from './aggregateFixture'

it('recomputes requested and actual runtime diagnostics from raw evidence instead of uploaded summaries', () => {
  const { identity, report } = fixture('hmr:stateful-experimental:weapp-vite-template')
  for (const row of report.primary.samples) {
    for (const value of row.values) {
      Object.assign(value, { runtimeBefore: row.side === 'baseline' ? 'stateful' : 'standard', runtimeAfter: row.side === 'baseline' ? 'stateful' : 'standard', ...(row.side === 'optimized' ? { profilePipeline: 'standard' } : {}) })
    }
  }
  const verified = verifyShard({ ...report, runtimeSummary: { requestedRuntime: 'classic' }, failureReasons: [{ kind: 'feature-budget', side: 'optimized' }] }, identity)
  const observations = report.manifest.metrics.length * 20
  expect(verified.gate.status).toBe('passed')
  expect(verified.failureReasons).toEqual([])
  expect(verified.runtimeSummary).toMatchObject({
    requestedRuntime: 'stateful-experimental',
    unit: 'metric-observations',
    primary: {
      baseline: { observations, runtimeBefore: { stateful: observations }, runtimeAfter: { stateful: observations }, profilePipeline: { unknown: observations } },
      optimized: { observations, runtimeBefore: { standard: observations }, runtimeAfter: { standard: observations }, profilePipeline: { standard: observations } },
    },
  })
  const rendered = renderTarget({ id: 'target', status: verified.gate.status, headSha: identity.headSha, baselineSha: identity.baselineSha, systems: [{ os: identity.os, parts: [{ shard: identity.shard, ...verified }] }] })
  expect(rendered).toContain('请求 runtime：`stateful-experimental`')
  expect(rendered).toContain(`| primary / baseline | ${observations} | stateful: ${observations} | stateful: ${observations} | unknown: ${observations} |`)
  expect(rendered).toContain(`| primary / optimized | ${observations} | standard: ${observations} | standard: ${observations} | standard: ${observations} |`)
})

it('retains baseline-only collection failure and missing observations despite forged empty reasons', () => {
  const { identity, report } = fixture('hmr:stateful-experimental:weapp-vite-template')
  report.primary.errors.push('primary pair 9 baseline: Timed out waiting for a stateful HMR patch batch')
  report.primary.samples.find(row => row.side === 'baseline' && row.round === 8)!.values = []
  const verified = verifyShard({ ...report, gate: { status: 'incomplete' }, failureReasons: [] }, identity)
  expect(verified.gate.status).toBe('incomplete')
  expect(verified.failureReasons).toContainEqual({ kind: 'collection', batch: 'primary', side: 'baseline', round: 9, message: report.primary.errors[0] })
  expect(verified.failureReasons.filter(reason => reason.kind === 'comparison')).toHaveLength(report.manifest.metrics.length)
  expect(verified.runtimeSummary?.primary.baseline.observations).toBe(report.manifest.metrics.length * 19)
  expect(() => verifyShard({ ...report, failureReasons: [] }, identity)).toThrow('Stored gate')
})

it.each(['paired-v3-profile-capability', 'paired-v4-template-consumption'])('keeps missing runtime fields unknown in a matching historical %s report', (samplingContract) => {
  const { identity, report } = fixture('hmr:stateful-experimental:weapp-vite-template')
  const verified = verifyShard({ ...report, samplingContract }, { ...identity, samplingContract })
  const observations = report.manifest.metrics.length * 20
  expect(verified.gate.status).toBe('passed')
  for (const side of ['baseline', 'optimized'] as const) {
    const summary = verified.runtimeSummary?.primary[side]
    expect(summary?.observations).toBe(observations)
    for (const field of ['runtimeBefore', 'runtimeAfter', 'profilePipeline'] as const) {
      expect(summary?.[field]).toEqual({ standard: 0, stateful: 0, unknown: observations })
    }
  }
})

it('keeps a baseline-only feature budget failure as regression while cross-commit comparison passes', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-budget-diagnostics-'))
  const affected = plan.matrix.find(row => row.shard === 'auto-build')!
  const scenario = 'auto-build:1:manual:repeat'
  try {
    for (const row of plan.matrix) {
      const { report } = fixture(row.shard, row.os)
      if (row.artifact === affected.artifact) {
        for (const sample of report.primary.samples) {
          for (const value of sample.values) {
            value.ms = sample.side === 'baseline' && value.id === scenario.replace(':manual:', ':automatic:') ? 1300 : 1000
          }
        }
        Object.assign(report, { featureCosts: [], failureReasons: [] })
      }
      const directory = path.join(root, row.artifact)
      await mkdir(directory)
      await writeFile(path.join(directory, 'report.json'), JSON.stringify(report))
    }
    const result = (await aggregatePlan(plan, root)).targets[0]!
    const system = result.systems.find(system => system.os === affected.os)!
    const part = system.parts.find(part => part.shard === affected.shard)!
    expect(part.gate.status).toBe('passed')
    expect(part.failureReasons).toEqual([{ kind: 'feature-budget', side: 'baseline', scenario, extraMs: 300, extraPercent: 30 }])
    expect(system.status).toBe('regression')
    expect(result.status).toBe('regression')
    const markdown = renderTarget(result)
    expect(markdown).toContain('功能预算越线 baseline / `auto-build:1:manual:repeat`：增加 300.00 ms / 30.00%')
    const firstDetail = markdown.indexOf('#### ')
    const lastPart = result.systems.at(-1)!.parts.at(-1)!
    expect(markdown.indexOf(`${result.systems.at(-1)!.os} / ${lastPart.gate.scenarios.at(-1)!.id}`)).toBeLessThan(firstDetail)
    await rm(path.join(root, affected.artifact), { recursive: true })
    const missing = (await aggregatePlan(plan, root)).targets[0]!.systems.find(system => system.os === affected.os)!.parts.find(part => part.shard === affected.shard)!
    expect(missing.gate.status).toBe('incomplete')
    expect(missing.failureReasons).toMatchObject([{ kind: 'collection', batch: 'primary', side: 'unknown' }])
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
