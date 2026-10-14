import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { expect, it, vi } from 'vitest'
import { candidateInvocation, createCandidatePlan, previousRunId, publishCandidatePlan } from './candidate.mjs'
import { metricsForShard, policy, statusContext } from './contract.mjs'
import { hmrProfileCapability } from './profileCapability.mjs'
import { validatePlan } from './publish.mjs'

const sha = 'a'.repeat(40)
const repository = 'owner/repo'
const ref = `refs/tags/codex/performance-candidate/${sha}`
const env = { CANDIDATE_SHA: sha, GITHUB_SHA: sha, GITHUB_REPOSITORY: repository, GITHUB_EVENT_NAME: 'push', GITHUB_REF: ref, GITHUB_RUN_ID: '10' }
const run = { id: 10, name: 'Candidate Performance', path: '.github/workflows/candidate-performance.yml', event: 'push', head_sha: sha, head_branch: ref.slice('refs/tags/'.length), head_repository: { full_name: repository }, html_url: 'https://example.test/run/10' }

it.each([
  { CANDIDATE_SHA: 'main' },
  { CANDIDATE_SHA: 'b'.repeat(40) },
  { GITHUB_REF: 'refs/heads/main' },
  { GITHUB_REF: 'refs/tags/codex/performance-candidate/latest' },
  { GITHUB_EVENT_NAME: 'pull_request' },
  { GITHUB_REPOSITORY: '../foreign/repo' },
])('rejects a moving, mismatched or implicit candidate before any request: %j', async (change) => {
  const get = vi.fn()
  await expect(createCandidatePlan({ ...env, ...change }, get)).rejects.toThrow()
  expect(get).not.toHaveBeenCalled()
})

it('accepts an explicitly dispatched full SHA at the actual workflow commit', () => {
  expect(candidateInvocation({ ...env, GITHUB_EVENT_NAME: 'workflow_dispatch', GITHUB_REF: 'refs/heads/codex/fix' })).toMatchObject({ sha, event: 'workflow_dispatch' })
})

it('freezes a distinct candidate with the original 27 shards and never queries main or PRs', async () => {
  const get = vi.fn(async (endpoint: string) => {
    if (endpoint === `/commits/${sha}`) {
      return { sha }
    }
    if (endpoint === `/commits/${sha}/statuses?per_page=100&page=1`) {
      return []
    }
    throw new Error(`Unexpected candidate query: ${endpoint}`)
  })
  const plan = await createCandidatePlan(env, get)
  expect(plan.targets).toMatchObject([{ kind: 'candidate', id: `candidate-${sha}`, headSha: sha, prNumber: null, baselineSha: policy.baselineSha }])
  expect(plan.matrix).toHaveLength(27)
  expect(plan.matrix.every((row: { headSha: string, baselineSha: string }) => row.headSha === sha && row.baselineSha === policy.baselineSha)).toBe(true)
  expect(() => validatePlan(plan, run, repository, { candidate: true })).not.toThrow()
  expect(() => validatePlan(plan, run, repository)).toThrow('explicit candidate')
  expect(get).toHaveBeenCalledTimes(2)
  for (const change of [{ head_sha: 'b'.repeat(40) }, { event: 'schedule' }, { head_branch: 'main' }, { name: 'Nightly Performance' }, { head_repository: { full_name: 'foreign/repo' } }]) {
    expect(() => validatePlan(plan, { ...run, ...change }, repository, { candidate: true })).toThrow()
  }
  for (const change of [{ id: 'main' }, { headRepository: 'foreign/repo' }, { headSha: 'b'.repeat(40) }, { prNumber: 7 }, { baselineSha: 'b'.repeat(40) }]) {
    expect(() => validatePlan({ ...plan, targets: [{ ...plan.targets[0], ...change }] }, run, repository, { candidate: true })).toThrow()
  }
})

it.each(['pending', 'failure'])('reuses an existing %s attempt without collecting again', async (state) => {
  const status = { context: statusContext({ headSha: sha, baselineSha: policy.baselineSha }), state, target_url: 'https://github.com/owner/repo/actions/runs/1', creator: { type: 'Bot' } }
  const get = vi.fn(async (endpoint: string) => endpoint === `/commits/${sha}` ? { sha } : [status])
  const plan = await createCandidatePlan(env, get)
  expect(plan.targets).toEqual([])
  expect(plan.matrix).toEqual([])
  expect(plan.reused).toMatchObject([{ id: `candidate-${sha}`, previous: { state } }])
  expect(await publishCandidatePlan(plan, run, '.', get)).toBe(false)
  expect(get.mock.calls.every(([endpoint]) => !endpoint.startsWith('/statuses/'))).toBe(true)
})

it.each([
  'https://github.com/foreign/repo/actions/runs/1',
  'https://example.test/owner/repo/actions/runs/1',
  'https://github.com/owner/repo/actions/runs/../1',
  'https://github.com/owner/repo/actions/runs/1?redirect=1',
])('rejects foreign or ambiguous previous evidence URLs: %s', (url) => {
  expect(() => previousRunId({ previous: { url } }, repository, 'https://github.com')).toThrow('Untrusted')
})

it('requires retained raw evidence even when a previous Bot status is successful', async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-reused-'))
  const previousRun = { ...run, id: 1, html_url: 'https://github.com/owner/repo/actions/runs/1' }
  const status = { context: statusContext({ headSha: sha, baselineSha: policy.baselineSha }), state: 'success', target_url: previousRun.html_url, creator: { type: 'Bot' } }
  const get = vi.fn(async (endpoint: string) => {
    if (endpoint === `/commits/${sha}`) {
      return { sha }
    }
    if (endpoint === '/actions/runs/1') {
      return previousRun
    }
    return [status]
  })
  try {
    const original = await createCandidatePlan({ ...env, GITHUB_RUN_ID: '1' }, async (endpoint: string) => endpoint === `/commits/${sha}` ? { sha } : [])
    const reused = await createCandidatePlan(env, get)
    expect(reused.matrix).toEqual([])
    await expect(publishCandidatePlan(reused, run, root, get)).rejects.toThrow('ENOENT')
    const previousRoot = path.join(root, 'previous')
    await mkdir(path.join(previousRoot, 'performance-plan'), { recursive: true })
    await writeFile(path.join(previousRoot, 'performance-plan/plan.json'), JSON.stringify(original))
    for (const row of original.matrix) {
      const metrics = metricsForShard(row.shard)
      const count = row.shard === 'build' || row.shard === 'auto-build' ? 7 : 20
      const samples = Array.from({ length: count }, (_, round) => (round % 2 ? ['optimized', 'baseline'] : ['baseline', 'optimized']).map((side) => {
        const capability = row.shard.startsWith('hmr:') ? hmrProfileCapability(side, side === 'baseline' ? policy.baselineSha : sha, row.shard.split(':')[1]) : undefined
        return { round, side, profileCapability: capability, values: metrics.map((id: string) => ({ id, ms: side === 'baseline' ? 100 : 102, profileStatus: capability?.status === 'unavailable' ? 'unavailable' : 'missing', output: { pageCount: 1, templateDigest: 'a'.repeat(64), configDigest: 'b'.repeat(64) } })) }
      })).flat()
      const directory = path.join(previousRoot, row.artifact)
      await mkdir(directory)
      await writeFile(path.join(directory, 'report.json'), JSON.stringify({
        schemaVersion: 2,
        purpose: 'full',
        samplingContract: policy.samplingContract,
        driverSha: sha,
        headSha: sha,
        baselineSha: policy.baselineSha,
        targetId: row.target,
        prNumber: null,
        runId: '1',
        os: row.os,
        shard: row.shard,
        baseline: { commit: policy.baselineSha },
        optimized: { commit: sha },
        manifest: { metrics },
        executionPlan: { metrics, confirmation: [] },
        primary: { errors: [], samples },
        gate: { status: 'passed' },
      }))
    }
    expect(await publishCandidatePlan(reused, run, root, get)).toBe(true)
    await rm(path.join(previousRoot, original.matrix.at(-1).artifact), { recursive: true })
    expect(await publishCandidatePlan(reused, run, root, get)).toBe(false)
    expect(get.mock.calls.every(([endpoint]) => !endpoint.startsWith('/statuses/'))).toBe(true)
    previousRun.head_branch = 'main'
    await expect(publishCandidatePlan(reused, run, root, get)).rejects.toThrow('invocation')
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})

it('keeps missing raw shards incomplete and cannot publish a passing candidate status', async () => {
  const get = vi.fn(async (endpoint: string) => endpoint === `/commits/${sha}` ? { sha } : [])
  const plan = await createCandidatePlan(env, get)
  const root = await mkdtemp(path.join(os.tmpdir(), 'performance-candidate-'))
  const publish = vi.fn(async (_endpoint: string, _body?: object) => [{ context: statusContext(plan.targets[0]), target_url: run.html_url, creator: { type: 'Bot' } }])
  try {
    expect(await publishCandidatePlan(plan, run, root, publish)).toBe(false)
    expect(publish).toHaveBeenLastCalledWith(`/statuses/${sha}`, expect.objectContaining({ state: 'failure' }))
  }
  finally {
    await rm(root, { recursive: true, force: true })
  }
})
