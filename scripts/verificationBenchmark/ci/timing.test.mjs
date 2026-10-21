import { expect, it } from 'vitest'
import { ciCriticalPath } from '../ci.mjs'

const complete = { name: 'build', status: 'completed', conclusion: 'success', started_at: '2026-10-19T00:00:00Z', completed_at: '2026-10-19T00:00:01Z' }
const skipped = { name: 'conditional matrix', status: 'completed', conclusion: 'skipped' }
const configuration = expectedCount => ({ needs: { build: [] }, outOfScope: { [skipped.name]: { reason: 'Non-selected frozen conditional branch', expectedCount } } })

it('counts identically named skipped conditional matrix jobs exactly', () => {
  expect(ciCriticalPath([complete, skipped, skipped], configuration(2))).toEqual({ durationMs: 1000, jobs: ['build'] })
  for (const count of [1, 3, 0, -1, 1.5, undefined]) {
    expect(() => ciCriticalPath([complete, skipped, skipped], configuration(count))).toThrow(/cover|out-of-scope/u)
  }
})

it('keeps executed names unique and rejects mixed executed/skipped names', () => {
  expect(() => ciCriticalPath([complete, complete], { build: [] })).toThrow(/unique/u)
  expect(() => ciCriticalPath([complete, { ...skipped, name: complete.name }], configuration(1))).toThrow(/successful|cover/u)
  expect(() => ciCriticalPath([complete, { ...complete, name: skipped.name }, skipped], configuration(1))).toThrow(/out-of-scope/u)
})
