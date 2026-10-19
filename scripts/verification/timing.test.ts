import type { TimingRecord } from './timing.ts'
import { expect, it } from 'vitest'
import { measurePhase } from './timing.ts'

it('records success and preserves failure identity if diagnostics fail', async () => {
  const records: TimingRecord[] = []
  expect(await measurePhase('build', async () => 42, record => records.push(record))).toBe(42)
  expect(records[0]).toMatchObject({ name: 'build', status: 'passed' })
  expect(records[0]!.durationMs).toBeGreaterThanOrEqual(0)
  const failure = new Error('operation failed')
  await expect(measurePhase('test', async () => {
    throw failure
  }, () => {
    throw new Error('sink failed')
  })).rejects.toBe(failure)
})
