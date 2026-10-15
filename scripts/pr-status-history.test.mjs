import { describe, expect, it, vi } from 'vitest'
import { publishPrStatus } from '../.github/scripts/publish-pr-status.mjs'
import { reconcilePrStatuses } from '../.github/scripts/reconcile-pr-status.mjs'

const repository = 'example/project'
const driverSha = 'a'.repeat(40)
const headSha = 'b'.repeat(40)
const baseSha = 'c'.repeat(40)
const pull = {
  state: 'open',
  created_at: '2026-01-01T00:00:00Z',
  head: { sha: headSha, ref: 'feature', repo: { full_name: repository } },
  base: { sha: baseSha, ref: 'main', repo: { full_name: repository } },
}
function run(id, name = 'CI', file = 'ci.yml') {
  return {
    id,
    name,
    path: `.github/workflows/${file}`,
    run_attempt: 1,
    event: 'workflow_dispatch',
    head_branch: 'main',
    head_repository: { full_name: repository },
    head_sha: driverSha,
    status: 'completed',
    conclusion: 'success',
  }
}
function context(id) {
  return {
    schemaVersion: 1,
    repository,
    runId: String(id),
    driverSha,
    isPr: true,
    shouldRun: true,
    prNumber: 42,
    headSha,
    baseSha,
    headRef: 'feature',
    baseRef: 'main',
    headRepository: repository,
    checkoutSha: 'd'.repeat(40),
    checkoutMode: 'merge',
  }
}

function harness(runs) {
  const api = { pull, baseSha, runs, contexts: new Map(runs.map(item => [item.id, context(item.id)])), statuses: [], writes: [] }
  const request = vi.fn(async (pathname, options = {}) => {
    if (options.method === 'POST') {
      api.writes.push(options.body)
      api.statuses.unshift({ ...options.body, creator: { login: 'github-actions[bot]', type: 'Bot' } })
      return {}
    }
    if (pathname === `/repos/${repository}/pulls/42`) {
      return api.pull
    }
    if (pathname.startsWith(`/repos/${repository}/git/ref/heads/`)) {
      return { object: { sha: api.baseSha } }
    }
    if (pathname.includes('/actions/runs?')) {
      const page = Number(new URL(pathname, 'https://api.example.test').searchParams.get('page'))
      return { workflow_runs: api.runs.slice((page - 1) * 100, page * 100) }
    }
    if (pathname.includes('/commits/')) {
      return api.statuses
    }
    const id = Number(pathname.split('/').at(-1))
    const source = api.runs.find(item => item.id === id)
    if (source) {
      return source
    }
    throw new Error(`Unexpected API path: ${pathname}`)
  })
  const readContext = vi.fn(async source => api.contexts.get(source.id))
  const verifyContext = vi.fn(async source => api.verify?.(source) ?? api.contexts.get(source.id))
  return { api, options: { repository, defaultBranch: 'main', prNumber: 42, request, readContext, verifyContext } }
}

describe('manual PR history reconciliation', () => {
  it('backfills every distinct workflow on the current PR head, rather than only the newly dispatched policy', async () => {
    const { api, options } = harness([run(5, 'CI Policy', 'ci-policy.yml'), run(4), run(3, 'CI E2E', 'ci-e2e.yml'), run(2)])
    const result = await reconcilePrStatuses(options)
    expect(result.results).toHaveLength(3)
    expect(api.writes.map(item => item.context)).toEqual(['Manual PR / CI Policy', 'Manual PR / CI', 'Manual PR / CI E2E'])
    expect(api.writes.find(item => item.context === 'Manual PR / CI').target_url).toContain('/runs/4/')
    expect(options.verifyContext).toHaveBeenCalledTimes(3)
  })

  it('ignores runs for other PRs, old heads, standalone dispatch and non-default branches', async () => {
    const { api, options } = harness([run(6), run(5), run(4), { ...run(3), head_branch: 'feature' }, run(2)])
    api.contexts.set(6, { ...context(6), prNumber: 99 })
    api.contexts.set(5, { ...context(5), headSha: driverSha })
    api.contexts.set(4, { isPr: false })
    await reconcilePrStatuses(options)
    expect(api.writes).toHaveLength(1)
    expect(api.writes[0].target_url).toContain('/runs/2/')
    expect(options.verifyContext).toHaveBeenCalledTimes(1)
  })

  it('keeps looking when a newer artifact lacks trusted provenance', async () => {
    const { api, options } = harness([run(3), run(2)])
    api.verify = (source) => {
      if (source.id === 3) {
        throw Object.assign(new Error('Artifact was replaced'), { code: 'PR_CONTEXT_UNTRUSTED' })
      }
      return context(source.id)
    }
    await reconcilePrStatuses(options)
    expect(api.writes).toHaveLength(1)
    expect(api.writes[0].target_url).toContain('/runs/2/')
  })

  it('skips missing artifacts but preserves API failures', async () => {
    const first = harness([run(2), run(1)])
    first.options.readContext.mockRejectedValueOnce(Object.assign(new Error('Not ready'), { code: 'PR_CONTEXT_MISSING' }))
    await reconcilePrStatuses(first.options)
    expect(first.api.writes).toHaveLength(1)
    const second = harness([run(2)])
    second.options.readContext.mockRejectedValue(new Error('GitHub API unavailable'))
    await expect(reconcilePrStatuses(second.options)).rejects.toThrow('API unavailable')
    expect(second.api.writes).toHaveLength(0)
  })

  it('backfills a changed-base result as requiring rerun instead of claiming a current pass', async () => {
    const { api, options } = harness([run(2)])
    api.pull = { ...pull, base: { ...pull.base, sha: driverSha } }
    await reconcilePrStatuses(options)
    expect(api.writes[0].state).toBe('error')
    expect(api.writes[0].description).toContain('PR base changed')
  })

  it('detects the actual branch moving even when the PR API still returns its old base snapshot', async () => {
    const { api, options } = harness([run(2)])
    api.baseSha = driverSha
    await reconcilePrStatuses(options)
    expect(api.pull.base.sha).toBe(baseSha)
    expect(api.writes[0].state).toBe('error')
    expect(api.writes[0].description).toContain('PR base changed')
  })

  it('keeps an actual failed validation visible when its baseline also moved', async () => {
    const { api, options } = harness([{ ...run(2), conclusion: 'failure' }])
    api.baseSha = driverSha
    await reconcilePrStatuses(options)
    expect(api.writes[0].state).toBe('failure')
    expect(api.writes[0].description).toContain('failed; base changed')
  })

  it('paginates history since PR creation and reports a bounded truncated scan', async () => {
    const runs = Array.from({ length: 100 }, (_, index) => ({ ...run(200 - index), head_branch: 'untrusted' }))
    const complete = harness([...runs, run(99)])
    expect(await reconcilePrStatuses(complete.options)).toMatchObject({ truncated: false })
    expect(complete.api.writes).toHaveLength(1)
    expect(complete.options.request.mock.calls.some(([pathname]) => pathname.includes('page=2'))).toBe(true)
    expect(complete.options.request.mock.calls.some(([pathname]) => pathname.includes('created=%3E%3D2026-01-01'))).toBe(true)
    const bounded = harness([...runs, run(99)])
    expect(await reconcilePrStatuses({ ...bounded.options, maxPages: 1 })).toMatchObject({ truncated: true })
    expect(bounded.api.writes).toHaveLength(0)
  })

  it('does not overwrite a newer workflow result already published on the same head', async () => {
    const { api, options } = harness([run(2)])
    api.statuses = [{ context: 'Manual PR / CI', state: 'pending', description: 'run 3/1: later run' }]
    await reconcilePrStatuses(options)
    expect(api.writes).toHaveLength(0)
  })

  it.each(['', '0', '1;echo unsafe', '9007199254740992'])('rejects invalid PR input %s', async (prNumber) => {
    const { options } = harness([])
    await expect(reconcilePrStatuses({ ...options, prNumber })).rejects.toThrow('positive PR number')
    expect(options.request).not.toHaveBeenCalled()
  })
})

describe('legacy status provenance fallback', () => {
  it('checks the verified context identity before publishing without an initial receipt', async () => {
    const { api, options } = harness([run(2)])
    const source = api.runs[0]
    expect(await publishPrStatus({ ...options, run: source, context: context(2) })).toMatchObject({ state: 'success' })
    expect(options.verifyContext).toHaveBeenCalledWith(source, 'main')
    expect(api.writes).toHaveLength(1)
  })

  it('rejects substitution between artifact read and provenance verification', async () => {
    const { api, options } = harness([run(2)])
    api.verify = () => ({ ...context(2), shouldRun: false })
    await expect(publishPrStatus({ ...options, run: api.runs[0], context: context(2) })).rejects.toThrow('context changed')
    expect(api.writes).toHaveLength(0)
  })

  it('keeps using the existing trusted receipt without downloading old logs again', async () => {
    const { api, options } = harness([run(2)])
    const input = { ...options, run: api.runs[0], context: context(2) }
    await publishPrStatus({ ...input, phase: 'pending' })
    await publishPrStatus(input)
    expect(options.verifyContext).not.toHaveBeenCalled()
    expect(api.writes.at(-1).state).toBe('success')
  })
})
