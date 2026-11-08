import { describe, expect, it, vi } from 'vitest'
import { nativeReportJobs, publishNativePrReport } from '../.github/scripts/publish-native-pr-report.mjs'
import { runtimeSizeSchema } from '../.github/scripts/runtime-size-schema.mjs'
import { policy, shards, smokeMetrics } from './performanceGate/contract.mjs'
import { publishComment, smokeStatus } from './performanceGate/publish.mjs'

const repository = 'example/project'
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const driverSha = 'c'.repeat(40)
const controlSha = 'd'.repeat(40)
const refreshTitle = (pins = {}) => `PR CI refresh #${pins.prNumber ?? 42} head=${pins.headSha ?? headSha} base=${pins.baseSha ?? baseSha} merge=${pins.checkoutSha ?? driverSha}`
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

function fixture(refresh = false) {
  const run = { id: 123, run_attempt: 1, head_branch: pull.head.ref, head_repository: pull.head.repo, name: 'PR CI', event: 'pull_request', path: '.github/workflows/ci-pr.yml', status: 'completed', conclusion: 'failure', head_sha: headSha, pull_requests: [pull], repository: { id: 1, full_name: repository } }
  run.referenced_workflows = [{ path: `${repository}/.github/workflows/validate-ci.yml@${driverSha}`, sha: driverSha, ref: 'refs/pull/42/merge' }]
  const context = { schemaVersion: 1, event: 'pull_request', repository, runId: '123', runAttempt: 1, driverSha, isPr: true, shouldRun: true, prNumber: 42, headSha, baseSha, headRef: 'feature', baseRef: 'main', headRepository: 'contributor/project', checkoutMode: 'merge', checkoutSha: driverSha, selections: { 'ci-performance': true, 'wevu-runtime-size': true } }
  if (refresh) {
    Object.assign(run, { event: 'workflow_dispatch', display_title: refreshTitle(), head_sha: controlSha, head_branch: 'main', head_repository: { id: 1, full_name: repository }, pull_requests: [], referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${controlSha}`, sha: controlSha, ref: 'refs/heads/main' }] })
    Object.assign(context, { event: 'native_refresh', driverSha: controlSha, controlRef: 'main', headRepository: repository, headRepositoryId: 1, baseRepositoryId: 1 })
  }
  const jobs = [
    { name: 'CI / Build and Test (windows-latest / Node 22)', conclusion: 'failure', steps: [] },
    { name: 'Performance Smoke / Performance Smoke', conclusion: 'success', html_url: 'https://example.test/smoke', steps: [{ name: 'Run correctness smoke', conclusion: 'success' }] },
    { name: 'Wevu Runtime Size / Runtime Size (Ubuntu / Node 24)', conclusion: 'success', html_url: 'https://example.test/size', steps: [] },
    { name: 'Approve PR checks', conclusion: 'success' },
    { name: 'Freeze approved PR target', conclusion: 'success' },
  ]
  const state = { pull, baseSha, mergeSha: driverSha, runs: [run], comments: [], files: [{ filename: 'README.md' }], writes: [], artifacts: { 'performance-smoke-report/smoke.json': smokeReport(), 'wevu-runtime-size-report/report-full.json': sizeReport() } }
  if (refresh) {
    state.pull = { ...pull, head: { ...pull.head, repo: { id: 1, full_name: repository } } }
  }
  const request = vi.fn(async (endpoint, body) => {
    if (body) {
      state.writes.push({ endpoint, body })
      return {}
    }
    if (endpoint === '') {
      return { id: 1, full_name: repository, default_branch: 'main' }
    }
    if (endpoint === '/git/ref/pull/42/merge') {
      return { ref: 'refs/pull/42/merge', object: { sha: state.mergeSha } }
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
      const page = Number(new URL(endpoint, 'https://api.example.test').searchParams.get('page')) || 1
      return { workflow_runs: state.runs.slice((page - 1) * 100, page * 100) }
    }
    if (endpoint.startsWith(`/actions/runs/${run.id}/jobs`)) {
      const page = Number(new URL(endpoint, 'https://api.example.test').searchParams.get('page')) || 1
      return { jobs: jobs.slice((page - 1) * 100, page * 100) }
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
  it.each([false, true].flatMap(refresh => ['Approve PR checks', 'Freeze approved PR target'].map(name => ({ refresh, name }))))('does not read artifacts or publish without successful $name (refresh=$refresh)', async ({ refresh, name }) => {
    const { state, options } = fixture(refresh)
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

  it('publishes smoke with a verified canonical base despite a stale REST snapshot', async () => {
    const { state, options } = fixture()
    state.pull = { ...pull, base: { ...pull.base, sha: 'd'.repeat(40) } }
    options.run.pull_requests = [state.pull]
    options.context.selections['wevu-runtime-size'] = false
    expect(await publishNativePrReport(options)).toEqual({ published: true })
    expect(state.writes).toHaveLength(1)
    expect(state.writes[0].body.body).toContain('正确性冒烟通过')
  })

  it('keeps the strict base snapshot contract for callers without native verification', async () => {
    const { state, options } = fixture()
    state.pull = { ...pull, base: { ...pull.base, sha: 'd'.repeat(40) } }
    expect(await publishComment({ prNumber: 42, headSha, baseSha }, 'historical report', options.request)).toBe(false)
    expect(state.writes).toHaveLength(0)
    expect(options.request.mock.calls).toEqual([['/pulls/42']])
  })

  it.each(['smoke', 'size'].flatMap(kind => ['base', 'merge', 'head', 'base-ref'].map(changed => ({ kind, changed }))))('rechecks native $changed after listing existing $kind comments', async ({ kind, changed }) => {
    const { state, options } = fixture()
    options.context.selections[kind === 'smoke' ? 'wevu-runtime-size' : 'ci-performance'] = false
    const request = options.request
    options.request = async (endpoint, ...args) => {
      const result = await request(endpoint, ...args)
      if (endpoint.startsWith('/issues/42/comments') && args[0] === undefined) {
        if (changed === 'base') {
          state.baseSha = 'd'.repeat(40)
        }
        if (changed === 'merge') {
          state.pull = { ...pull, merge_commit_sha: 'd'.repeat(40) }
        }
        if (changed === 'head') {
          state.pull = { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } }
        }
        if (changed === 'base-ref') {
          state.pull = { ...pull, base: { ...pull.base, ref: 'next' } }
        }
      }
      return result
    }
    expect((await publishNativePrReport(options)).published).toBe(false)
    expect(state.writes).toHaveLength(0)
  })

  it('does not publish an unassociated fork artifact even when all live evidence matches', async () => {
    const { state, options } = fixture()
    options.run.pull_requests = []
    expect(await publishNativePrReport(options)).toEqual({ published: false, reason: 'unassociated-pr' })
    expect(state.writes).toHaveLength(0)
    expect(options.request).not.toHaveBeenCalled()
    expect(options.readArtifact).not.toHaveBeenCalled()
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

  it('publishes an approved refresh with distinct control and tested merge despite a stale REST merge snapshot', async () => {
    const { state, options } = fixture(true)
    state.pull = { ...state.pull, merge_commit_sha: 'e'.repeat(40) }
    expect(options.run.head_sha).not.toBe(options.context.checkoutSha)
    expect(await publishNativePrReport(options)).toEqual({ published: true })
    expect(state.writes).toHaveLength(2)
    expect(state.writes[0].body.body).toContain(`HEAD: \`${headSha}\``)
    expect(state.writes[1].body.body).toContain('完整 Provider')
  })

  it.each(['prNumber', 'headSha', 'baseSha', 'checkoutSha'])('rejects a refresh artifact that substitutes title-bound %s', async (key) => {
    const { state, options } = fixture(true)
    options.context[key] = key === 'prNumber' ? 43 : 'e'.repeat(40)
    await expect(publishNativePrReport(options)).rejects.toThrow()
    expect(state.writes).toHaveLength(0)
    expect(options.readArtifact).not.toHaveBeenCalled()
  })

  it.each(['driverSha', 'runId', 'runAttempt'])('rejects refresh artifact substitution of %s', async (key) => {
    const { state, options } = fixture(true)
    options.context[key] = key === 'driverSha' ? driverSha : key === 'runId' ? '124' : 2
    await expect(publishNativePrReport(options)).rejects.toThrow()
    expect(state.writes).toHaveLength(0)
    expect(options.readArtifact).not.toHaveBeenCalled()
  })

  it.each(['headSha', 'baseSha', 'checkoutSha'])('rejects a canonical but forged refresh title %s instead of trusting its artifact', async (key) => {
    const { state, options } = fixture(true)
    options.run.display_title = refreshTitle({ [key]: 'e'.repeat(40) })
    await expect(publishNativePrReport(options)).rejects.toThrow()
    expect(state.writes).toHaveLength(0)
    expect(options.readArtifact).not.toHaveBeenCalled()
  })

  it.each(['head', 'base', 'canonical-merge'])('rejects an approved refresh after live %s changes', async (change) => {
    const { state, options } = fixture(true)
    if (change === 'head') {
      state.pull = { ...state.pull, head: { ...state.pull.head, sha: 'e'.repeat(40) } }
    }
    if (change === 'base') {
      state.baseSha = 'e'.repeat(40)
    }
    if (change === 'canonical-merge') {
      state.mergeSha = 'e'.repeat(40)
    }
    expect((await publishNativePrReport(options)).published).toBe(false)
    expect(state.writes).toHaveLength(0)
    expect(options.readArtifact).not.toHaveBeenCalled()
  })

  it.each(['smoke', 'size'].flatMap(kind => ['head', 'base', 'canonical-merge'].map(change => ({ kind, change }))))('rechecks refresh $change after listing $kind comments', async ({ kind, change }) => {
    const { state, options } = fixture(true)
    options.context.selections[kind === 'smoke' ? 'wevu-runtime-size' : 'ci-performance'] = false
    const request = options.request
    options.request = async (endpoint, ...args) => {
      const result = await request(endpoint, ...args)
      if (endpoint.startsWith('/issues/42/comments') && args[0] === undefined) {
        if (change === 'head') {
          state.pull = { ...state.pull, head: { ...state.pull.head, sha: 'e'.repeat(40) } }
        }
        if (change === 'base') {
          state.baseSha = 'e'.repeat(40)
        }
        if (change === 'canonical-merge') {
          state.mergeSha = 'e'.repeat(40)
        }
      }
      return result
    }
    expect((await publishNativePrReport(options)).published).toBe(false)
    expect(state.writes).toHaveLength(0)
  })

  it.each([false, true].flatMap(refresh => [false, true].map(newerRefresh => ({ refresh, newerRefresh }))))('supersedes only the same head across native entries (refresh=$refresh, newerRefresh=$newerRefresh)', async ({ refresh, newerRefresh }) => {
    const { state, options } = fixture(refresh)
    state.runs.push({ ...fixture(newerRefresh).options.run, id: 124 })
    expect(await publishNativePrReport(options)).toEqual({ published: false, reason: 'newer-run' })
    expect(state.writes).toHaveLength(0)
    expect(options.readArtifact).not.toHaveBeenCalled()
  })

  it('ignores unrelated refresh target heads and unpinned diagnostic dispatches during supersession', async () => {
    const { state, options } = fixture(true)
    state.runs.push(
      { ...options.run, id: 124, display_title: refreshTitle({ headSha: 'e'.repeat(40) }) },
      { ...options.run, id: 125, display_title: 'Manual diagnostics', head_sha: headSha },
      { ...options.run, id: 126, name: 'Other', head_sha: headSha },
    )
    expect(await publishNativePrReport(options)).toEqual({ published: true })
    expect(state.writes).toHaveLength(2)
  })

  it('finds a newer same-head refresh after a full page of unrelated runs', async () => {
    const { state, options } = fixture()
    const refresh = fixture(true).options.run
    state.runs = [...Array.from({ length: 100 }, (_, index) => ({ ...refresh, id: 200 + index, display_title: refreshTitle({ headSha: 'e'.repeat(40) }) })), { ...refresh, id: 124 }]
    expect(await publishNativePrReport(options)).toEqual({ published: false, reason: 'newer-run' })
    expect(state.writes).toHaveLength(0)
    expect(options.readArtifact).not.toHaveBeenCalled()
    expect(options.request.mock.calls.some(([endpoint]) => endpoint.startsWith('/actions/workflows/ci-pr.yml/runs') && endpoint.includes('page=2'))).toBe(true)
  })
})

describe('Nightly feedback for native PR smoke', () => {
  it.each(['native-newer', 'manual-newer', 'missing-context', 'stale-context', 'unassociated-context'])('selects the latest trusted run across both entries: %s', async (scenario) => {
    const { options } = fixture()
    if (scenario === 'unassociated-context') {
      options.run.pull_requests = []
    }
    const manual = { id: scenario === 'manual-newer' ? 124 : 122, name: 'Performance Smoke', path: '.github/workflows/ci-performance.yml', event: 'workflow_dispatch', head_sha: driverSha, head_branch: 'main', head_repository: { full_name: repository }, status: 'completed', conclusion: 'failure' }
    const lateJobs = [...Array.from({ length: 100 }).fill(options.jobs[0]), { ...options.jobs[1], status: 'completed' }, ...options.jobs.slice(3)]
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

describe('Nightly feedback for protected native refreshes', () => {
  it.each(['current', 'stale-base', 'stale-merge', 'unapproved', 'unfrozen', 'forged-title', 'foreign-control'])('uses only the approved current frozen target: %s', async (scenario) => {
    const { state, options } = fixture(true)
    options.jobs[1].status = 'completed'
    if (scenario === 'stale-base') {
      state.baseSha = 'e'.repeat(40)
    }
    if (scenario === 'stale-merge') {
      state.mergeSha = 'e'.repeat(40)
    }
    if (scenario === 'unapproved' || scenario === 'unfrozen') {
      options.jobs.find(job => job.name === (scenario === 'unapproved' ? 'Approve PR checks' : 'Freeze approved PR target')).conclusion = 'skipped'
    }
    if (scenario === 'forged-title') {
      options.run.display_title = refreshTitle({ headSha: 'e'.repeat(40) })
    }
    if (scenario === 'foreign-control') {
      options.run.referenced_workflows[0].ref = 'refs/pull/42/merge'
    }
    const get = vi.fn(async endpoint => endpoint.startsWith('/actions/workflows/ci-performance.yml/runs') ? { workflow_runs: [] } : options.request(endpoint))
    const readContext = vi.fn(async () => options.context)
    expect(await smokeStatus({ prNumber: 42, headSha, baseSha }, { get, readContext, repository })).toBe(scenario === 'current' ? '通过或无需冒烟' : '未运行')
    if (['unapproved', 'unfrozen', 'foreign-control'].includes(scenario)) {
      expect(readContext).not.toHaveBeenCalled()
    }
    expect(state.writes).toHaveLength(0)
  })

  it('discovers an approved refresh beyond the first native run page without accepting an unrelated newer dispatch', async () => {
    const { state, options } = fixture(true)
    options.jobs[1].status = 'completed'
    state.runs = [...Array.from({ length: 100 }, (_, index) => ({ ...options.run, id: 200 + index, display_title: refreshTitle({ headSha: 'e'.repeat(40) }) })), options.run]
    const get = vi.fn(async endpoint => endpoint.startsWith('/actions/workflows/ci-performance.yml/runs') ? { workflow_runs: [] } : options.request(endpoint))
    const readContext = vi.fn(async ({ run }) => {
      if (run.id !== options.run.id) {
        throw new Error('Unrelated dispatch has no target context')
      }
      return options.context
    })
    expect(await smokeStatus({ prNumber: 42, headSha, baseSha }, { get, readContext, repository })).toBe('通过或无需冒烟')
    expect(get.mock.calls.some(([endpoint]) => endpoint.startsWith('/actions/workflows/ci-pr.yml/runs') && endpoint.includes('page=2'))).toBe(true)
    expect(state.writes).toHaveLength(0)
  })
})
