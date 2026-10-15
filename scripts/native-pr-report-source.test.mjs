import { describe, expect, it, vi } from 'vitest'
import { nativeReportRunId, resolveNativeReportSource } from '../.github/scripts/publish-native-pr-report.mjs'

const repository = 'example/project'
const run = { id: 123, name: 'PR CI', path: '.github/workflows/ci-pr.yml', event: 'pull_request', status: 'completed', conclusion: 'failure', repository: { full_name: repository } }
const approvedJobs = [{ name: 'Approve PR checks', conclusion: 'success' }, { name: 'Freeze approved PR target', conclusion: 'success' }]

describe('native report invocation', () => {
  it('accepts automatic successful native runs', () => {
    expect(nativeReportRunId('workflow_run', { workflow_run: { ...run, conclusion: 'success' } }, 'refs/heads/main')).toBe('123')
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

  it.each(approvedJobs.flatMap(({ name }) => ['failure', 'cancelled', 'timed_out', 'skipped', null].map(conclusion => ({ name, conclusion }))))('skips downloads when $name concludes $conclusion', async ({ name, conclusion }) => {
    const jobs = approvedJobs.map(job => ({ ...job, conclusion: job.name === name ? conclusion : job.conclusion }))
    const request = vi.fn(async endpoint => endpoint === '/actions/runs/123' ? run : { jobs })
    expect((await resolveNativeReportSource(repository, '123', request)).shouldReport).toBe(false)
  })

  it.each(approvedJobs.map(job => job.name))('skips downloads when %s is missing', async (name) => {
    const jobs = approvedJobs.filter(job => job.name !== name)
    const request = vi.fn(async endpoint => endpoint === '/actions/runs/123' ? run : { jobs })
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
})
