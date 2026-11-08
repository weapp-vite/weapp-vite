import { describe, expect, it, vi } from 'vitest'
import { nativeReportRunId, resolveNativeReportSource } from '../.github/scripts/publish-native-pr-report.mjs'

const repository = 'example/project'
const run = { id: 123, name: 'PR CI', path: '.github/workflows/ci-pr.yml', event: 'pull_request', status: 'completed', conclusion: 'failure', repository: { full_name: repository } }
const approvedJobs = [{ name: 'Approve PR checks', conclusion: 'success' }, { name: 'Freeze approved PR target', conclusion: 'success' }]
const headSha = 'a'.repeat(40)
const baseSha = 'b'.repeat(40)
const mergeSha = 'c'.repeat(40)
const controlSha = 'd'.repeat(40)

function refreshRun() {
  return { ...run, event: 'workflow_dispatch', run_attempt: 1, display_title: `PR CI refresh #42 head=${headSha} base=${baseSha} merge=${mergeSha}`, head_sha: controlSha, head_branch: 'main', repository: { id: 1, full_name: repository }, head_repository: { id: 1, full_name: repository }, referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${controlSha}`, sha: controlSha, ref: 'refs/heads/main' }] }
}

function sourceRequest(source, jobs = approvedJobs, metadata = { id: 1, full_name: repository, default_branch: 'main' }) {
  return vi.fn(async (endpoint) => {
    if (endpoint === '/actions/runs/123') {
      return source
    }
    if (endpoint === '') {
      return metadata
    }
    if (endpoint.startsWith('/actions/runs/123/jobs?')) {
      const page = Number(new URL(endpoint, 'https://api.example.test').searchParams.get('page'))
      return { jobs: jobs.slice((page - 1) * 100, page * 100) }
    }
    throw new Error(`Unexpected API: ${endpoint}`)
  })
}

describe('native report invocation', () => {
  it('accepts automatic successful native runs', () => {
    expect(nativeReportRunId('workflow_run', { workflow_run: { ...run, conclusion: 'success' } }, 'refs/heads/main')).toBe('123')
  })

  it('accepts successful protected refreshes, but not diagnostic or unpinned dispatches', () => {
    const source = refreshRun()
    expect(nativeReportRunId('workflow_run', { workflow_run: { ...source, conclusion: 'success' } }, 'refs/heads/main')).toBe('123')
    for (const change of [{ display_title: 'PR CI refresh #42' }, { path: '.github/workflows/ci-performance.yml' }, { conclusion: 'failure' }]) {
      expect(() => nativeReportRunId('workflow_run', { workflow_run: { ...source, conclusion: 'success', ...change } }, 'refs/heads/main')).toThrow('successful workflow_run')
    }
  })

  it.each(['failure', 'cancelled', 'timed_out', 'action_required', 'skipped', 'neutral', 'stale', 'startup_failure'])('rejects automatic %s reporting', (conclusion) => {
    expect(() => nativeReportRunId('workflow_run', { workflow_run: { ...run, conclusion } }, 'refs/heads/main')).toThrow('successful workflow_run')
  })

  it('accepts a manually selected failed run only from the default branch', () => {
    const event = { repository: { default_branch: 'main' }, inputs: { 'run-id': '123' } }
    expect(nativeReportRunId('workflow_dispatch', event, 'refs/heads/main')).toBe('123')
    expect(() => nativeReportRunId('workflow_dispatch', event, 'refs/heads/feature')).toThrow('default-branch')
    expect(() => nativeReportRunId('workflow_dispatch', event, 'refs/tags/main')).toThrow('default-branch')
  })

  it.each(['', '0', '-1', '00123', '123\n', '123?other=true'])('rejects invalid manual run IDs: %j', (id) => {
    expect(() => nativeReportRunId('workflow_dispatch', { repository: { default_branch: 'main' }, inputs: { 'run-id': id } }, 'refs/heads/main')).toThrow('run ID')
  })

  it.each([{ name: 'Other' }, { event: 'pull_request_target' }])('rejects unrelated automatic runs: %j', (change) => {
    expect(() => nativeReportRunId('workflow_run', { workflow_run: { ...run, conclusion: 'success', ...change } }, 'refs/heads/main')).toThrow('successful workflow_run')
  })
})

describe('native report source before artifact downloads', () => {
  it.each([
    { name: 'Other' },
    { path: '.github/workflows/ci.yml' },
    { event: 'pull_request_target' },
    { status: 'in_progress' },
    { repository: { full_name: 'other/project' } },
    { id: 124 },
  ])('rejects an invalid source before fetching jobs: %j', async (change) => {
    const request = vi.fn(async () => ({ ...run, ...change }))
    await expect(resolveNativeReportSource(repository, '123', request)).rejects.toThrow()
    expect(request.mock.calls).toEqual([['/actions/runs/123']])
  })

  it.each([false, true].flatMap(refresh => approvedJobs.flatMap(({ name }) => ['failure', 'cancelled', 'timed_out', 'skipped', null].map(conclusion => ({ refresh, name, conclusion })))))('skips downloads when $name concludes $conclusion (refresh=$refresh)', async ({ refresh, name, conclusion }) => {
    const jobs = approvedJobs.map(job => ({ ...job, conclusion: job.name === name ? conclusion : job.conclusion }))
    const request = sourceRequest(refresh ? refreshRun() : run, jobs)
    expect((await resolveNativeReportSource(repository, '123', request)).shouldReport).toBe(false)
  })

  it.each([false, true].flatMap(refresh => approvedJobs.map(job => ({ refresh, name: job.name }))))('skips downloads when $name is missing (refresh=$refresh)', async ({ refresh, name }) => {
    const jobs = approvedJobs.filter(job => job.name !== name)
    const request = sourceRequest(refresh ? refreshRun() : run, jobs)
    expect((await resolveNativeReportSource(repository, '123', request)).shouldReport).toBe(false)
  })

  it('finds successful approval and freeze beyond the first 100 jobs, including a failed overall run', async () => {
    const jobs = [...Array.from({ length: 100 }).fill({ name: 'Other job', conclusion: 'failure' }), ...approvedJobs]
    const request = vi.fn(async (endpoint) => {
      if (endpoint === '/actions/runs/123') {
        return run
      }
      const page = Number(new URL(endpoint, 'https://api.example.test').searchParams.get('page'))
      return { jobs: jobs.slice((page - 1) * 100, page * 100) }
    })
    expect(await resolveNativeReportSource(repository, '123', request)).toMatchObject({ run, jobs, shouldReport: true })
    expect(request.mock.calls).toHaveLength(3)
    expect(request.mock.calls[2][0]).toContain('page=2')
  })

  it('authenticates protected control provenance before admitting a failed refresh as a report source', async () => {
    const source = refreshRun()
    const request = sourceRequest(source)
    expect(await resolveNativeReportSource(repository, '123', request)).toMatchObject({ run: source, jobs: approvedJobs, shouldReport: true })
    expect(request.mock.calls.map(([endpoint]) => endpoint)).toEqual(['/actions/runs/123', '', '/actions/runs/123/jobs?filter=latest&per_page=100&page=1'])
  })

  it.each([
    { head_branch: 'feature' },
    { head_branch: 'refs/tags/main' },
    { head_repository: { id: 2, full_name: repository } },
    { head_repository: { id: 1, full_name: 'other/project' } },
    { run_attempt: 0 },
    { referenced_workflows: [] },
    { referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${mergeSha}`, sha: mergeSha, ref: 'refs/heads/main' }] },
    { referenced_workflows: [{ path: `${repository}/.github/workflows/validate-ci.yml@${controlSha}`, sha: controlSha, ref: 'refs/pull/42/merge' }] },
  ])('rejects refresh control forgery before listing jobs: %j', async (change) => {
    const request = sourceRequest({ ...refreshRun(), ...change })
    await expect(resolveNativeReportSource(repository, '123', request)).rejects.toThrow()
    expect(request.mock.calls.map(([endpoint]) => endpoint)).toEqual(['/actions/runs/123', ''])
  })

  it('does not trust a matching control branch without authoritative default-branch metadata', async () => {
    const request = sourceRequest(refreshRun(), approvedJobs, { id: 1, full_name: repository, default_branch: 'next' })
    await expect(resolveNativeReportSource(repository, '123', request)).rejects.toThrow()
    expect(request.mock.calls.map(([endpoint]) => endpoint)).toEqual(['/actions/runs/123', ''])
  })

  it.each([
    `PR CI refresh #042 head=${headSha} base=${baseSha} merge=${mergeSha}`,
    `PR CI refresh #42 head=${headSha.toUpperCase()} base=${baseSha} merge=${mergeSha}`,
    `PR CI refresh #42 head=${headSha} base=${baseSha} merge=${mergeSha}\n`,
    `PR CI refresh #42 head=${headSha} base=${baseSha}`,
  ])('rejects a noncanonical refresh title before reading repository or artifacts: %j', async (display_title) => {
    const request = sourceRequest({ ...refreshRun(), display_title })
    await expect(resolveNativeReportSource(repository, '123', request)).rejects.toThrow()
    expect(request.mock.calls).toEqual([['/actions/runs/123']])
  })
})
