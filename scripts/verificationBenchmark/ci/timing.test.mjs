import { expect, it } from 'vitest'
import { ciRunMetrics } from '../ci.mjs'
import { jobs, needs, statuses, time } from './fixture.mjs'

const run = { status: 'completed', conclusion: 'success' }

it('measures approval-to-completion wall time independently of manual approval waiting', () => {
  const earlierWaiting = statuses.map(status => status.state === 'waiting' ? { ...status, created_at: time(-50) } : status)
  const first = ciRunMetrics(run, jobs, statuses, needs)
  const second = ciRunMetrics(run, jobs, earlierWaiting, needs)
  expect(second.approvalWaitMs).toBe(58000)
  expect(second.approvalToCompletionMs).toBe(first.approvalToCompletionMs)
  expect(second.approvalToCompletionMs).toBe(16000)
})

it('includes runner queue delay and the last executed job even outside the pure critical path', () => {
  const delayed = jobs.map(job => job.name === 'lint' ? { ...job, started_at: time(21), completed_at: time(28) } : job)
  const first = ciRunMetrics(run, jobs, statuses, needs)
  const second = ciRunMetrics(run, delayed, statuses, needs)
  expect(second.executionMs).toBe(first.executionMs)
  expect(second.runnerMs).toBe(first.runnerMs)
  expect(second.approvalToCompletionMs).toBe(20000)
  expect(second.schedulingWaitMs).toBe(15000)
})

it('excludes explicitly skipped jobs from the last completed execution boundary', () => {
  const skipped = { name: 'manual-diagnostic', status: 'completed', conclusion: 'skipped', completed_at: time(60) }
  const result = ciRunMetrics(run, [...jobs, skipped], statuses, { needs, outOfScope: { 'manual-diagnostic': 'manual diagnostics are outside this PR run' } })
  expect(result.approvalToCompletionMs).toBe(16000)
})

it.each([24, 25])('rejects an approval boundary %s without a strictly positive observed interval', (seconds) => {
  const values = statuses.map(status => status.state === 'queued' ? { ...status, created_at: time(seconds) } : status)
  expect(() => ciRunMetrics(run, jobs, values, needs)).toThrow(/approval-to-completion interval must be positive/u)
})
