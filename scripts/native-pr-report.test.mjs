import { describe, expect, it, vi } from 'vitest'
import { nativeReportJobs, publishNativePrReport } from '../.github/scripts/publish-native-pr-report.mjs'
import { runtimeSizeSchema } from '../.github/scripts/runtime-size-schema.mjs'
import { policy, shards, smokeMetrics } from './performanceGate/contract.mjs'
import { smokeStatus } from './performanceGate/publish.mjs'

const repository = 'example/project'
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const driverSha = 'c'.repeat(40)
const pull = { number: 42, state: 'open', merge_commit_sha: driverSha, head: { sha: headSha, ref: 'feature', repo: { id: 2, full_name: 'contributor/project' } }, base: { sha: baseSha, ref: 'main', repo: { id: 1, full_name: repository } } }

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
  const run = { id: 123, run_attempt: 1, head_branch: pull.head.ref, head_repository: pull.head.repo, name: 'PR CI', event: 'pull_request', path: '.github/workflows/ci-pr.yml', status: 'completed', conclusion: 'failure', head_sha: headSha, pull_requests: [pull], repository: { id: 1, full_name: repository } }
  run.referenced_workflows = [{ path: `${repository}/.github/workflows/validate-ci.yml@${driverSha}`, sha: driverSha, ref: 'refs/pull/42/merge' }]
  const context = { schemaVersion: 1, event: 'pull_request', repository, runId: '123', runAttempt: 1, driverSha, isPr: true, shouldRun: true, prNumber: 42, headSha, baseSha, headRef: 'feature', baseRef: 'main', headRepository: 'contributor/project', checkoutMode: 'merge', checkoutSha: driverSha, selections: { 'ci-performance': true, 'wevu-runtime-size': true } }
  const jobs = [
    { name: 'CI / Build and Test (windows-latest / Node 22)', conclusion: 'failure', steps: [] },
    { name: 'Performance Smoke / Performance Smoke', conclusion: 'success', html_url: 'https://example.test/smoke', steps: [{ name: 'Run correctness smoke', conclusion: 'success' }] },
    { name: 'Wevu Runtime Size / Runtime Size (Ubuntu / Node 24)', conclusion: 'success', html_url: 'https://example.test/size', steps: [] },
    { name: 'Approve PR checks', conclusion: 'success' },
    { name: 'Freeze approved PR target', conclusion: 'success' },
  ]
  const state = { pull, baseSha, runs: [run], comments: [], files: [{ filename: 'README.md' }], writes: [], artifacts: { 'performance-smoke-report/smoke.json': smokeReport(), 'wevu-runtime-size-report/report-full.json': sizeReport() } }
  const request = vi.fn(async (endpoint, body) => {
    if (body) {
      state.writes.push({ endpoint, body })
      return {}
    }
    if (endpoint === '/git/ref/pull/42/merge') {
      return { ref: 'refs/pull/42/merge', object: { sha: driverSha } }
    }
    if (endpoint === `/git/commits/${driverSha}`) {
      return { sha: driverSha, parents: [{ sha: baseSha }, { sha: headSha }] }
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
  it.each(['Approve PR checks', 'Freeze approved PR target'])('does not read artifacts or publish without successful %s', async (name) => {
    const { state, options } = fixture()
    options.jobs.find(job => job.name === name).conclusion = 'failure'
    expect(await publishNativePrReport(options)).toEqual({ published: false, reason: 'unapproved-run' })
    expect(state.writes).toHaveLength(0)
    expect(options.readArtifact).not.toHaveBeenCalled()
    expect(options.request).not.toHaveBeenCalled()
  })

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
      state.baseSha = 'd'.repeat(40)
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

  it('rechecks the canonical base after reading evidence and before writing a comment', async () => {
    const { state, options } = fixture()
    const readArtifact = options.readArtifact
    options.readArtifact = async (name) => {
      const report = await readArtifact(name)
      state.baseSha = 'd'.repeat(40)
      return report
    }
    expect(await publishNativePrReport(options)).toEqual({ published: false, reason: 'stale-base' })
    expect(state.writes).toHaveLength(0)
  })

  it('does not confuse same-named steps in another check with the performance jobs', () => {
    const jobs = [{ name: 'Other / Build', conclusion: 'success', steps: [{ name: 'Run correctness smoke' }] }]
    expect(nativeReportJobs(jobs)).toEqual({ smoke: undefined, runtime: undefined })
  })
})

describe('Nightly feedback for native PR smoke', () => {
  it.each(['native-newer', 'manual-newer', 'missing-context', 'stale-context'])('selects the latest trusted run across both entries: %s', async (scenario) => {
    const { options } = fixture()
    const manual = { id: scenario === 'manual-newer' ? 124 : 122, name: 'Performance Smoke', path: '.github/workflows/ci-performance.yml', event: 'workflow_dispatch', head_sha: driverSha, head_branch: 'main', head_repository: { full_name: repository }, status: 'completed', conclusion: 'failure' }
    const lateJobs = [...Array.from({ length: 100 }).fill(options.jobs[0]), { ...options.jobs[1], status: 'completed' }]
    const get = vi.fn(async (endpoint) => {
      if (endpoint === '') {
        return { default_branch: 'main' }
      }
      if (endpoint.startsWith('/actions/workflows/ci-performance.yml/runs')) {
        return { workflow_runs: [manual] }
      }
      if (endpoint.startsWith('/actions/workflows/ci-pr.yml/runs')) {
        return { workflow_runs: [options.run] }
      }
      if (endpoint.startsWith('/actions/runs/123/jobs')) {
        const page = Number(new URL(endpoint, 'https://api.example.test').searchParams.get('page'))
        return { jobs: lateJobs.slice((page - 1) * 100, page * 100) }
      }
      return options.request(endpoint)
    })
    const readContext = vi.fn(async ({ run }) => {
      if (run.event === 'workflow_dispatch') {
        return { ...options.context, runId: String(manual.id), checkoutMode: 'head', checkoutSha: headSha }
      }
      if (scenario === 'missing-context') {
        throw new Error('Approval has not produced a context yet')
      }
      return { ...options.context, ...(scenario === 'stale-context' ? { headSha: 'd'.repeat(40) } : {}) }
    })
    expect(await smokeStatus({ prNumber: 42, headSha, baseSha }, { get, readContext, repository }))
      .toBe(scenario === 'native-newer' ? '通过或无需冒烟' : '🔴 未通过')
    if (scenario === 'native-newer') {
      expect(get.mock.calls.some(([endpoint]) => endpoint.includes('/jobs?') && endpoint.includes('page=2'))).toBe(true)
    }
  })
})
