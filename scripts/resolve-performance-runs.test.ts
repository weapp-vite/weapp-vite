import { describe, expect, it, vi } from 'vitest'
import { downloadPrContext, resolvePerformanceRuns } from '../.github/scripts/resolve-performance-runs.mjs'

const repository = 'owner/repo'
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const driverSha = 'c'.repeat(40)
const run = {
  id: 10,
  name: 'Wevu Runtime Size',
  path: '.github/workflows/wevu-runtime-size.yml',
  event: 'workflow_dispatch',
  status: 'completed',
  conclusion: 'success',
  head_sha: driverSha,
  head_branch: 'main',
  head_repository: { full_name: repository },
  updated_at: '2026-01-01T00:00:00Z',
}
const context = {
  schemaVersion: 1,
  repository,
  runId: String(run.id),
  driverSha,
  isPr: true,
  shouldRun: true,
  prNumber: 7,
  headSha,
  baseSha,
  headRef: 'feature',
  baseRef: 'main',
  headRepository: 'fork/repo',
  checkoutSha: headSha,
  checkoutMode: 'head',
}
const pull = { state: 'open', head: { sha: headSha, repo: { full_name: 'fork/repo' } }, base: { sha: baseSha } }
const options = { apiUrl: 'https://api.example.test', token: 'test-only', repository, run }

function requestFor(pullValue = pull, runs = [run]) {
  return vi.fn(async (_url: string, _token: string, pathname: string) => {
    if (pathname === `/repos/${repository}`) {
      return { default_branch: 'main' }
    }
    if (pathname === `/repos/${repository}/pulls/7`) {
      return pullValue
    }
    if (pathname.startsWith(`/repos/${repository}/actions/runs?`)) {
      return { workflow_runs: runs }
    }
    throw new Error(`Unexpected endpoint ${pathname}`)
  })
}

describe('resolve manual performance runs', () => {
  it('maps a trusted default-branch dispatch to a fork PR head and base, not the driver SHA', async () => {
    const result = await resolvePerformanceRuns({ ...options, request: requestFor(), readContext: vi.fn().mockResolvedValue(context) })
    expect(result).toMatchObject({ context: { prNumber: 7, headSha, baseSha }, runtimeRun: { id: 10 } })
    if (!result) {
      throw new Error('Expected the current PR performance context')
    }
    expect(result.context.headSha).not.toBe(run.head_sha)
  })

  it.each([
    { event: 'pull_request' },
    { head_branch: 'feature' },
    { head_repository: { full_name: 'fork/repo' } },
    { path: '.github/workflows/untrusted.yml' },
  ])('rejects untrusted reporting invocation %j before reading artifacts', async (change) => {
    const readContext = vi.fn()
    await expect(resolvePerformanceRuns({ ...options, run: { ...run, ...change }, request: requestFor(), readContext })).rejects.toThrow('trusted default-branch')
    expect(readContext).not.toHaveBeenCalled()
  })

  it.each([{ driverSha: headSha }, { runId: '11' }, { repository: 'fork/repo' }, { checkoutSha: driverSha }])('rejects forged context metadata %j', async (change) => {
    await expect(resolvePerformanceRuns({ ...options, request: requestFor(), readContext: vi.fn().mockResolvedValue({ ...context, ...change }) })).rejects.toThrow('Untrusted manual PR context')
  })

  it('rejects a merge candidate context even when the common PR validator accepts it', async () => {
    await expect(resolvePerformanceRuns({ ...options, request: requestFor(), readContext: vi.fn().mockResolvedValue({ ...context, checkoutMode: 'merge', checkoutSha: 'd'.repeat(40) }) })).rejects.toThrow('frozen PR head checkout')
  })

  it.each([
    { ...pull, state: 'closed' },
    { ...pull, head: { ...pull.head, sha: 'd'.repeat(40) } },
    { ...pull, base: { sha: 'd'.repeat(40) } },
  ])('does not attach stale validation to the current PR %j', async (currentPull) => {
    const result = await resolvePerformanceRuns({ ...options, request: requestFor(currentPull), readContext: vi.fn().mockResolvedValue(context) })
    expect(result).toBeNull()
  })

  it('ignores newer runs for another PR, a different base and expired context artifacts', async () => {
    const runs = [11, 12, 13, 14].map(id => ({ ...run, id, updated_at: `2026-01-${id}T00:00:00Z` }))
    const readContext = vi.fn(async ({ run: candidate }: { run: typeof run }) => {
      if (candidate.id === 14) {
        throw new Error('Expired artifact')
      }
      return { ...context, runId: String(candidate.id), ...(candidate.id === 13 ? { prNumber: 8 } : candidate.id === 12 ? { baseSha: 'd'.repeat(40) } : {}) }
    })
    const result = await resolvePerformanceRuns({ ...options, request: requestFor(pull, runs), readContext })
    if (!result) {
      throw new Error('Expected a matching runtime run')
    }
    expect(result.runtimeRun.id).toBe(11)
    expect(readContext).toHaveBeenCalledTimes(5)
  })

  it('skips a standalone manual run before querying a PR', async () => {
    const request = requestFor()
    expect(await resolvePerformanceRuns({ ...options, request, readContext: vi.fn().mockResolvedValue({ ...context, isPr: false }) })).toBeNull()
    expect(request).toHaveBeenCalledTimes(1)
  })
})

describe('manual PR artifact availability', () => {
  it.each([
    { artifacts: [] },
    { artifacts: [{ name: 'pr-context', expired: true }] },
    { artifacts: [{ name: 'other', expired: false }] },
  ])('distinguishes a missing context artifact from an invalid one', async ({ artifacts }) => {
    await expect(downloadPrContext({ ...options, request: vi.fn().mockResolvedValue({ artifacts }) })).rejects.toMatchObject({ code: 'PR_CONTEXT_MISSING' })
  })

  it('rejects duplicate artifacts rather than treating them as not yet available', async () => {
    const artifacts = [{ name: 'pr-context', expired: false }, { name: 'pr-context', expired: false }]
    const error = await downloadPrContext({ ...options, request: vi.fn().mockResolvedValue({ artifacts }) }).catch((value: unknown) => value)
    expect(error).toBeInstanceOf(Error)
    expect(error).not.toHaveProperty('code', 'PR_CONTEXT_MISSING')
  })

  it('does not hide malformed API responses or request failures as missing artifacts', async () => {
    await expect(downloadPrContext({ ...options, request: vi.fn().mockResolvedValue({}) })).rejects.toThrow('Invalid manual PR context artifact listing')
    await expect(downloadPrContext({ ...options, request: vi.fn().mockRejectedValue(new Error('GitHub API unavailable')) })).rejects.toThrow('GitHub API unavailable')
  })
})
