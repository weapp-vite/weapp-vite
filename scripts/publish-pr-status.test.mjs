import { describe, expect, it, vi } from 'vitest'
import { publishPrStatus } from '../.github/scripts/publish-pr-status.mjs'

const repository = 'example/project'
const headSha = 'b'.repeat(40)
const baseSha = 'c'.repeat(40)
const driverSha = 'a'.repeat(40)
const mergeSha = 'd'.repeat(40)
const run = {
  id: 123,
  run_attempt: 1,
  name: 'CI',
  event: 'workflow_dispatch',
  head_branch: 'main',
  head_repository: { full_name: repository },
  path: '.github/workflows/ci.yml',
  head_sha: driverSha,
  status: 'completed',
  conclusion: 'success',
}
const context = {
  schemaVersion: 1,
  repository,
  runId: '123',
  runAttempt: 1,
  driverSha,
  isPr: true,
  shouldRun: true,
  prNumber: 42,
  headSha,
  baseSha,
  headRef: 'feature/change',
  baseRef: 'main',
  headRepository: 'contributor/project',
  checkoutSha: mergeSha,
  checkoutMode: 'merge',
}
const pull = {
  state: 'open',
  head: { sha: headSha, ref: context.headRef, repo: { full_name: context.headRepository } },
  base: { sha: baseSha, ref: 'main', repo: { full_name: repository } },
}
const bot = { login: 'github-actions[bot]', type: 'Bot' }

async function harness({ source = run, metadata = context, seed = true } = {}) {
  const api = { pull, run: source, statuses: [], writes: [], pullReads: 0, statusReads: 0 }
  const request = vi.fn(async (pathname, options = {}) => {
    if (options.method === 'POST') {
      api.writes.push({ pathname, body: options.body })
      api.statuses.unshift({ ...options.body, creator: bot })
      return { id: api.writes.length }
    }
    if (pathname === `/repos/${repository}/pulls/42`) {
      api.pullReads++
      return api.onPull?.(api.pullReads) ?? api.pull
    }
    if (pathname === `/repos/${repository}/actions/runs/${source.id}`) {
      return api.run
    }
    if (pathname.startsWith(`/repos/${repository}/commits/${headSha}/statuses?`)) {
      const page = Number(new URL(pathname, 'https://api.example.test').searchParams.get('page'))
      if (page === 1) {
        api.statusReads++
      }
      return api.onStatuses?.(api.statusReads, page) ?? api.statuses.slice((page - 1) * 100, page * 100)
    }
    throw new Error(`Unexpected API request: ${pathname}`)
  })
  const options = { repository, run: source, context: metadata, defaultBranch: 'main', request }
  if (seed) {
    await publishPrStatus({ ...options, phase: 'pending' })
    api.writes = []
    api.pullReads = 0
    api.statusReads = 0
    request.mockClear()
  }
  return { api, options }
}

describe('manual PR commit status publication', () => {
  it('links successful CI to the frozen fork PR HEAD, separately from main and merge commits', async () => {
    const { api, options } = await harness()
    expect(await publishPrStatus(options)).toMatchObject({ published: true, state: 'success', context: 'Manual PR / CI' })
    expect(api.writes).toEqual([{ pathname: `/repos/${repository}/statuses/${headSha}`, body: expect.objectContaining({
      state: 'success',
      context: 'Manual PR / CI',
      target_url: `https://github.com/${repository}/actions/runs/123/attempts/1`,
      description: expect.stringMatching(/^run 123\/1: proof [a-f\d]{64}; Manual validation passed$/u),
    }) }])
  })

  it('publishes pending as soon as trusted resolution finishes, even with no existing status', async () => {
    const { api, options } = await harness({ source: { ...run, status: 'in_progress', conclusion: null }, seed: false })
    expect(await publishPrStatus({ ...options, phase: 'pending' })).toMatchObject({ published: true, state: 'pending' })
    expect(api.writes).toHaveLength(1)
  })

  it.each([
    ['failure', 'failure'],
    ['cancelled', 'error'],
    ['timed_out', 'error'],
    ['action_required', 'error'],
    ['startup_failure', 'error'],
    ['neutral', 'error'],
    ['skipped', 'error'],
    [null, 'error'],
    ['unexpected', 'error'],
  ])('maps completed conclusion %s to %s without claiming a pass', async (conclusion, state) => {
    const { options } = await harness({ source: { ...run, conclusion } })
    expect(await publishPrStatus(options)).toMatchObject({ published: true, state })
  })

  it('marks an explicitly excluded path/branch as successful only after a successful or skipped run', async () => {
    for (const conclusion of ['success', 'skipped', 'cancelled']) {
      const { options } = await harness({ source: { ...run, conclusion }, metadata: { ...context, shouldRun: false } })
      expect(await publishPrStatus(options)).toMatchObject({ state: conclusion === 'cancelled' ? 'error' : 'success' })
    }
  })

  it('uses separate contexts for different workflows', async () => {
    const { options } = await harness({ source: { ...run, name: 'CI Policy', path: '.github/workflows/ci-policy.yml' } })
    expect(await publishPrStatus(options)).toMatchObject({ context: 'Manual PR / CI Policy' })
  })

  it('permits all current manual PR workflows including nightly performance', async () => {
    for (const [name, file] of [
      ['CI E2E', 'ci-e2e'],
      ['Create Weapp Vite Smoke', 'ci-create-weapp-vite'],
      ['Acceptance HTTP', 'ci-acceptance-http'],
      ['Acceptance and Agent', 'ci-acceptance'],
      ['Dimina Web Experiment', 'ci-dimina'],
      ['Vite Host Consumer', 'ci-vite-host-consumer'],
      ['VSCode Extension CI', 'ci-vscode-extension'],
      ['Tutorial E2E', 'ci-tutorial-e2e'],
      ['Deploy Website', 'deploy-website'],
      ['Native Addon Correctness', 'native-addon-correctness'],
      ['Performance Smoke', 'ci-performance'],
      ['Wevu Runtime Size', 'wevu-runtime-size'],
      ['Nightly Performance', 'nightly-performance'],
    ]) {
      const { options } = await harness({ source: { ...run, name, path: `.github/workflows/${file}.yml` } })
      expect(await publishPrStatus(options)).toMatchObject({ published: true, context: `Manual PR / ${name}` })
    }
  })

  it.each([
    { event: 'pull_request' },
    { head_branch: 'feature' },
    { head_repository: { full_name: 'attacker/project' } },
    { path: '.github/workflows/unknown.yml' },
    { name: 'CI Performance Comment' },
    { id: '../bad' },
  ])('rejects an untrusted workflow identity before any API calls', async (change) => {
    const { options } = await harness({ seed: false })
    await expect(publishPrStatus({ ...options, run: { ...run, ...change } })).rejects.toThrow()
    expect(options.request).not.toHaveBeenCalled()
  })

  it.each([
    { driverSha: headSha },
    { runId: '999' },
    { repository: 'another/project' },
    { headSha: 'invalid' },
  ])('rejects forged context identity', async (change) => {
    const { options } = await harness({ seed: false })
    await expect(publishPrStatus({ ...options, context: { ...context, ...change } })).rejects.toThrow()
    expect(options.request).not.toHaveBeenCalled()
  })

  it.each([
    { ...pull, state: 'closed' },
    { ...pull, head: { ...pull.head, sha: driverSha } },
    { ...pull, head: { ...pull.head, repo: { full_name: 'attacker/project' } } },
    { ...pull, base: { ...pull.base, repo: { full_name: 'another/project' } } },
  ])('ignores stale head, closed PR, or changed fork/target identity', async (changed) => {
    const { api, options } = await harness()
    api.pull = changed
    expect(await publishPrStatus(options)).toEqual({ published: false, reason: 'stale-pr' })
    expect(api.writes).toHaveLength(0)
  })

  it('reports a moved base as an error on the unchanged head requiring another dispatch', async () => {
    const { api, options } = await harness()
    api.pull = { ...pull, base: { ...pull.base, sha: driverSha } }
    expect(await publishPrStatus(options)).toMatchObject({ published: true, state: 'error' })
    expect(api.writes[0].body.description).toContain('PR base changed')
  })

  it('refuses completion without a trusted pending receipt and rejects artifact scope substitution', async () => {
    const missing = await harness({ seed: false })
    expect(await publishPrStatus(missing.options)).toEqual({ published: false, reason: 'missing-trusted-receipt' })
    const { api, options } = await harness()
    expect(await publishPrStatus({ ...options, context: { ...context, shouldRun: false } })).toEqual({ published: false, reason: 'missing-trusted-receipt' })
    api.statuses[0].creator = { login: 'contributor', type: 'User' }
    expect(await publishPrStatus(options)).toEqual({ published: false, reason: 'missing-trusted-receipt' })
    expect(api.writes).toHaveLength(0)
  })

  it('refuses receipts with substituted run URL, artifact checkout, or resolution error', async () => {
    for (const change of [{ checkoutSha: driverSha }, { resolutionError: 'made up' }]) {
      const { options } = await harness()
      expect(await publishPrStatus({ ...options, context: { ...context, ...change } })).toMatchObject({ reason: 'missing-trusted-receipt' })
    }
    const { api, options } = await harness()
    api.statuses[0].target_url = 'https://attacker.example/run'
    expect(await publishPrStatus(options)).toMatchObject({ reason: 'missing-trusted-receipt' })
  })

  it('preserves target-resolution failures as errors, including their trusted receipt', async () => {
    const { api, options } = await harness({ metadata: { ...context, resolutionError: 'No merge candidate' } })
    expect(await publishPrStatus(options)).toMatchObject({ reason: 'unchanged' })
    expect(api.statuses[0].state).toBe('error')
  })

  it.each([[124, 1], [123, 2]])('does not overwrite newer run %s attempt %s', async (id, attempt) => {
    const { api, options } = await harness()
    api.statuses.unshift({ context: 'Manual PR / CI', state: 'pending', description: `run ${id}/${attempt}: newer pending` })
    expect(await publishPrStatus(options)).toEqual({ published: false, reason: 'newer-run' })
    expect(api.writes).toHaveLength(0)
  })

  it('prevents delayed pending notification from overwriting a final result', async () => {
    const { api, options } = await harness()
    await publishPrStatus(options)
    api.writes = []
    expect(await publishPrStatus({ ...options, phase: 'pending' })).toEqual({ published: false, reason: 'already-final' })
    expect(api.writes).toHaveLength(0)
  })

  it('finds a newer status after the first status API page', async () => {
    const { api, options } = await harness()
    const receipt = api.statuses[0]
    api.statuses = [...Array.from({ length: 100 }, () => ({ context: 'Other', state: 'pending' })), receipt, {
      context: 'Manual PR / CI',
      state: 'pending',
      description: 'run 124/1: queued',
    }]
    expect(await publishPrStatus(options)).toMatchObject({ reason: 'newer-run' })
    expect(options.request.mock.calls.some(([pathname]) => pathname.includes('page=2'))).toBe(true)
  })

  it('rechecks PR movement and newer statuses immediately before writing', async () => {
    const first = await harness()
    first.api.onPull = reads => reads === 1 ? pull : { ...pull, head: { ...pull.head, sha: driverSha } }
    expect(await publishPrStatus(first.options)).toMatchObject({ reason: 'stale-pr' })
    const second = await harness()
    second.api.onStatuses = reads => reads === 1
      ? second.api.statuses
      : [...second.api.statuses, {
          context: 'Manual PR / CI',
          state: 'pending',
          description: 'run 124/1: queued',
        }]
    expect(await publishPrStatus(second.options)).toMatchObject({ reason: 'newer-run' })
    expect(first.api.writes).toHaveLength(0)
    expect(second.api.writes).toHaveLength(0)
  })

  it('rechecks the current run attempt and conclusion instead of publishing stale input', async () => {
    const first = await harness()
    first.api.run = { ...run, run_attempt: 2 }
    expect(await publishPrStatus(first.options)).toMatchObject({ reason: 'stale-attempt' })
    const second = await harness({ source: { ...run, status: 'in_progress', conclusion: null } })
    second.api.run = run
    expect(await publishPrStatus(second.options)).toMatchObject({ state: 'success' })
  })

  it('rejects contexts from a previous attempt and ignores standalone dispatch', async () => {
    const { options } = await harness({ seed: false })
    expect(await publishPrStatus({ ...options, context: { ...context, runAttempt: 2 } })).toMatchObject({ reason: 'stale-attempt' })
    expect(await publishPrStatus({ ...options, context: { isPr: false } })).toMatchObject({ reason: 'standalone' })
    expect(options.request).not.toHaveBeenCalled()
  })

  it('uses the trusted frozen artifact for rerun-failed-jobs, publishing the new attempt', async () => {
    const { api, options } = await harness()
    await publishPrStatus({ ...options, run: { ...run, conclusion: 'failure' } })
    const retry = { ...run, run_attempt: 2, status: 'in_progress', conclusion: null }
    api.run = retry
    expect(await publishPrStatus({ ...options, run: retry })).toMatchObject({ state: 'pending' })
    expect(api.statuses[0].target_url).toContain('/attempts/2')
    api.run = { ...retry, status: 'completed', conclusion: 'success' }
    expect(await publishPrStatus({ ...options, run: api.run })).toMatchObject({ state: 'success' })
  })

  it('requires a new proof receipt when rerun-all-jobs resolves a new artifact', async () => {
    const { api, options } = await harness()
    const retry = { ...run, run_attempt: 2 }
    const metadata = { ...context, runAttempt: 2 }
    api.run = retry
    expect(await publishPrStatus({ ...options, run: retry, context: metadata })).toMatchObject({ reason: 'missing-trusted-receipt' })
    expect(await publishPrStatus({ ...options, run: retry, context: metadata, phase: 'pending' })).toMatchObject({ state: 'pending' })
    expect(await publishPrStatus({ ...options, run: retry, context: metadata })).toMatchObject({ state: 'success' })
  })
})
