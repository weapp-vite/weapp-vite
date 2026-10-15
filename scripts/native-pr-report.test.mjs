import { describe, expect, it, vi } from 'vitest'
import { nativeReportJobs, publishNativePrReport } from '../.github/scripts/publish-native-pr-report.mjs'
import { runtimeSizeSchema } from '../.github/scripts/runtime-size-schema.mjs'
import { policy, shards, smokeMetrics } from './performanceGate/contract.mjs'

const repository = 'example/project'
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const driverSha = 'c'.repeat(40)
const pull = { number: 42, state: 'open', head: { sha: headSha, ref: 'feature', repo: { full_name: 'contributor/project' } }, base: { sha: baseSha, ref: 'main' } }

function smokeReport() {
  return {
    schemaVersion: 2,
    purpose: 'smoke',
    prNumber: 42,
    headSha,
    driverSha: headSha,
    baselineSha: policy.baselineSha,
    samplingContract: policy.samplingContract,
    status: 'passed',
    fullAcceptance: 'not-run',
    errors: [],
    executionPlan: { headOnly: true, metrics: shards.flatMap(smokeMetrics), confirmation: [] },
    stages: shards.map(shard => ({ shard, values: smokeMetrics(shard).map(id => ({ id, ms: 1, output: { pageCount: 1, configDigest: 'd'.repeat(64), templateDigest: 'e'.repeat(64) } })) })),
  }
}

function sizeReport() {
  const { targets, tiers } = runtimeSizeSchema(2)
  const report = commit => ({ version: 2, commit, targets: targets.map(target => ({ id: target.id, tiers: tiers.map(tier => ({ id: tier.id, dev: { bytes: 100 }, production: { bytes: 50, ...(target.gzip ? { gzipBytes: 25 } : {}) } })) })) })
  return { version: 2, kind: 'wevu-runtime-size-pr-report', repository, prNumber: 42, headSha, baseSha, current: report(headSha), baseline: report(baseSha) }
}

function fixture() {
  const run = { id: 123, name: 'PR CI', event: 'pull_request', path: '.github/workflows/ci-pr.yml', status: 'completed', conclusion: 'failure', head_sha: driverSha, pull_requests: [pull] }
  const context = { schemaVersion: 1, event: 'pull_request', repository, runId: '123', driverSha, isPr: true, shouldRun: true, prNumber: 42, headSha, baseSha, headRef: 'feature', baseRef: 'main', headRepository: 'contributor/project', checkoutMode: 'merge', checkoutSha: driverSha, selections: { 'ci-performance': true, 'wevu-runtime-size': true } }
  const jobs = [
    { name: 'CI / Build and Test (windows-latest / Node 22)', conclusion: 'failure', steps: [] },
    { name: 'Performance Smoke / Performance Smoke', conclusion: 'success', html_url: 'https://example.test/smoke', steps: [{ name: 'Run correctness smoke', conclusion: 'success' }] },
    { name: 'Wevu Runtime Size / Runtime Size (Ubuntu / Node 24)', conclusion: 'success', html_url: 'https://example.test/size', steps: [] },
  ]
  const state = { pull, baseSha, runs: [run], comments: [], files: [{ filename: 'README.md' }], writes: [], artifacts: { 'performance-smoke-report/smoke.json': smokeReport(), 'wevu-runtime-size-report/report-full.json': sizeReport() } }
  const request = vi.fn(async (endpoint, body) => {
    if (body) {
      state.writes.push({ endpoint, body })
      return {}
    }
    if (endpoint === '/pulls/42') {
      return state.pull
    }
    if (endpoint === '/git/ref/heads/main') {
      return { object: { sha: state.baseSha } }
    }
    if (endpoint.includes('/actions/workflows/')) {
      return { workflow_runs: state.runs }
    }
    if (endpoint.startsWith('/pulls/42/files')) {
      return state.files
    }
    if (endpoint.startsWith(`/commits/${headSha}/statuses`)) {
      return []
    }
    if (endpoint.startsWith('/issues/42/comments')) {
      return state.comments
    }
    throw new Error(`Unexpected API: ${endpoint}`)
  })
  const readArtifact = vi.fn(async (name) => {
    if (!state.artifacts[name]) {
      throw new Error('Missing report artifact')
    }
    return state.artifacts[name]
  })
  return { state, options: { repository, run, context, jobs, request, readArtifact } }
}

describe('native PR completion reporting', () => {
  it('publishes successful smoke and size despite another job failing', async () => {
    const { state, options } = fixture()
    expect(await publishNativePrReport(options)).toEqual({ published: true })
    expect(state.writes).toHaveLength(2)
    expect(state.writes[0].body.body).toContain('正确性冒烟通过')
    expect(state.writes[1].body.body).toContain('完整 Provider')
    expect(state.writes.every(write => write.endpoint === '/issues/42/comments')).toBe(true)
  })

  it('uses each actual job conclusion for failure and cancellation', async () => {
    const { state, options } = fixture()
    options.run.conclusion = 'success'
    options.jobs[1].conclusion = 'cancelled'
    options.jobs[2].conclusion = 'failure'
    await publishNativePrReport(options)
    expect(state.writes[0].body.body).toContain('cancelled')
    expect(state.writes[1].body.body).toContain('failure')
    expect(options.readArtifact).not.toHaveBeenCalled()
  })

  it('accepts irrelevant-path smoke skips and rejects relevant-path skips', async () => {
    const { state, options } = fixture()
    options.context.selections['wevu-runtime-size'] = false
    options.jobs[1].steps[0].conclusion = 'skipped'
    await publishNativePrReport(options)
    expect(state.writes[0].body.body).toContain('无需冒烟')
    state.files = [{ filename: 'packages/weapp-vite/src/index.ts' }]
    await expect(publishNativePrReport(options)).rejects.toThrow('cannot skip smoke')
  })

  it.each(['head', 'base', 'branch-tip', 'newer-run'])('does not publish obsolete results: %s', async (scenario) => {
    const { state, options } = fixture()
    if (scenario === 'head') {
      state.pull = { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } }
    }
    if (scenario === 'base') {
      state.pull = { ...pull, base: { ...pull.base, sha: 'd'.repeat(40) } }
    }
    if (scenario === 'branch-tip') {
      state.baseSha = 'd'.repeat(40)
    }
    if (scenario === 'newer-run') {
      state.runs.push({ ...options.run, id: 124 })
    }
    expect((await publishNativePrReport(options)).published).toBe(false)
    expect(state.writes).toHaveLength(0)
  })

  it('rejects mismatched report identity and missing successful evidence', async () => {
    const first = fixture()
    first.state.artifacts['performance-smoke-report/smoke.json'].headSha = 'd'.repeat(40)
    await expect(publishNativePrReport(first.options)).rejects.toThrow('Invalid smoke report')
    expect(first.state.writes).toHaveLength(0)
    const second = fixture()
    second.options.context.selections['ci-performance'] = false
    second.state.artifacts['wevu-runtime-size-report/report-full.json'].baseSha = 'd'.repeat(40)
    await expect(publishNativePrReport(second.options)).rejects.toThrow('base SHA')
    expect(second.state.writes).toHaveLength(0)
    const third = fixture()
    delete third.state.artifacts['performance-smoke-report/smoke.json']
    await expect(publishNativePrReport(third.options)).rejects.toThrow('Missing report')
  })

  it('does not confuse same-named steps in another check with the performance jobs', () => {
    const jobs = [{ name: 'Other / Build', conclusion: 'success', steps: [{ name: 'Run correctness smoke' }] }]
    expect(nativeReportJobs(jobs)).toEqual({ smoke: undefined, runtime: undefined })
  })
})
