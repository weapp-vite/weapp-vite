import { execFile } from 'node:child_process'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { promisify } from 'node:util'
import { expect, it } from 'vitest'
import { aggregatePlan, verifyShard } from './aggregate.mjs'
import { createMatrix, metricsForShard, policy, targetKey } from './contract.mjs'
import { publishComment, validatePlan } from './publish.mjs'

const target = { id: 'pr-7', prNumber: 7, headSha: 'a'.repeat(40), headRepository: 'owner/repo', baselineSha: policy.baselineSha }
const plan = { schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: 'b'.repeat(40), repository: 'owner/repo', runId: '10', targets: [{ ...target, key: targetKey(target) }], reused: [], matrix: createMatrix([target]) }
function fixture(shard = 'hmr:classic:weapp-vite-template', os = 'ubuntu-latest') {
  const identity = { schemaVersion: 2, purpose: 'full', samplingContract: policy.samplingContract, driverSha: plan.driverSha, headSha: target.headSha, baselineSha: target.baselineSha, targetId: target.id, prNumber: 7, runId: '10', os, shard }
  const metrics: string[] = metricsForShard(shard)
  const count = shard === 'build' || shard === 'auto-build' ? 7 : 20
  const samples = Array.from({ length: count }, (_, round) => (round % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']).map(side => ({ round, side, values: metrics.map(id => ({ id, ms: side === 'baseline' ? 100 : 102, output: { pageCount: 1, templateDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64) } })) }))).flat()
  return { identity, report: { ...identity, manifest: { metrics }, executionPlan: { metrics, confirmation: [] as string[] }, primary: { errors: [] as string[], samples }, gate: { status: 'passed' } } }
}

it('recomputes performance from raw samples, rejects duplicate rounds, bad SHA and smoke evidence', () => {
  const { identity, report } = fixture()
  expect(verifyShard(report, identity).gate.status).toBe('passed')
  expect(() => verifyShard({ ...report, headSha: 'c'.repeat(40) }, identity)).toThrow('identity')
  expect(() => verifyShard({ ...report, purpose: 'smoke' }, identity)).toThrow('identity')
  report.primary.samples.push(report.primary.samples[0]!)
  expect(() => verifyShard(report, identity)).toThrow('Duplicate')
})

it('keeps equal-sized confirmation regression and conflicting conclusions distinct', () => {
  const { identity, report } = fixture()
  const id = report.manifest.metrics[0]!
  for (const row of report.primary.samples) {
    if (row.side === 'optimized') {
      row.values.find(v => v.id === id)!.ms = 110
    }
  }
  const confirmation = { errors: [], samples: report.primary.samples.map(r => ({ ...r, values: r.values.filter(v => v.id === id).map(v => ({ ...v })) })) }
  report.executionPlan.confirmation = [id]
  expect(verifyShard({ ...report, confirmation, gate: { status: 'regression' } }, identity).gate.status).toBe('regression')
  for (const row of confirmation.samples) {
    if (row.side === 'optimized') {
      row.values[0]!.ms = 99
    }
  }
  expect(verifyShard({ ...report, confirmation, gate: { status: 'unstable' } }, identity).gate.status).toBe('unstable')
  confirmation.samples.pop()
  expect(verifyShard({ ...report, confirmation, gate: { status: 'incomplete' } }, identity).gate.status).toBe('incomplete')
})

it('does not allow build output mismatches or missing lifecycle phases to pass', () => {
  const { identity, report } = fixture('build')
  report.primary.samples[1]!.values[0]!.output.templateDigest = 'c'.repeat(64)
  expect(() => verifyShard(report, identity)).toThrow('Stored gate')
  expect(verifyShard({ ...report, gate: { status: 'incomplete' } }, identity).gate.status).toBe('incomplete')
})

it('requires all 27 shards and does not average away a missing platform', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-shards-'))
  try {
    for (const row of plan.matrix) {
      const dir = path.join(root, row.artifact)
      await mkdir(dir)
      await writeFile(path.join(dir, 'report.json'), JSON.stringify(fixture(row.shard, row.os).report))
    }
    expect((await aggregatePlan(plan, root)).targets[0].status).toBe('passed')
    const planFile = path.join(root, 'plan.json')
    await writeFile(planFile, JSON.stringify(plan))
    await promisify(execFile)(process.execPath, [path.join(import.meta.dirname, 'aggregate.mjs')], { cwd: root, env: { ...process.env, PERFORMANCE_PLAN: planFile, PERFORMANCE_ARTIFACTS: root } })
    const persisted = JSON.parse(await readFile(path.join(root, 'nightly-report.json'), 'utf8'))
    expect(persisted.targets[0].status).toBe('passed')
    await rm(path.join(root, plan.matrix.at(-1)!.artifact), { recursive: true })
    expect((await aggregatePlan(plan, root)).targets[0].status).toBe('incomplete')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('rejects forged planner metadata and refuses to overwrite a newer PR HEAD', async () => {
  expect(() => validatePlan(plan, { id: 10, head_sha: plan.driverSha }, 'owner/repo')).not.toThrow()
  expect(() => validatePlan({ ...plan, driverSha: 'c'.repeat(40) }, { id: 10, head_sha: plan.driverSha }, 'owner/repo')).toThrow('provenance')
  const calls: string[] = []
  const get = async (endpoint: string) => {
    calls.push(endpoint)
    return { state: 'open', head: { sha: 'c'.repeat(40) } }
  }
  expect(await publishComment(target, 'do not publish', get)).toBe(false)
  expect(calls).toEqual(['/pulls/7'])
})
