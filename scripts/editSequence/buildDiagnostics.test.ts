import { expect, it } from 'vitest'
import { SequenceBuildDiagnostics } from './buildDiagnostics'

it('bounds retained events and pending work without losing the latest observation state', async () => {
  let revision = 1
  const diagnostics = new SequenceBuildDiagnostics(() => ({ revision }))
  const tasks = Array.from({ length: 40 }, () => Promise.withResolvers<void>())
  const waiting = tasks.map((task, index) => diagnostics.wait(`publication-${index}`, () => task.promise))
  for (let index = 0; index < 100; index++) {
    diagnostics.record('source-read', { index })
  }
  revision = 2
  const pending = diagnostics.snapshot()
  expect(pending.state).toEqual({ revision: 2 })
  expect(pending.events).toHaveLength(32)
  expect(pending.events.at(-1)).toMatchObject({ phase: 'source-read', details: { index: 99 } })
  expect(pending.pending).toHaveLength(32)
  expect(pending.droppedPending).toBe(8)
  expect(pending.droppedEvents).toBe(108)
  tasks.forEach(task => task.resolve())
  await Promise.all(waiting)
  expect(diagnostics.snapshot().pending).toEqual([])
  expect(diagnostics.snapshot().events).toHaveLength(32)
})

it('retains the failed boundary while propagating the exact original failure', async () => {
  const diagnostics = new SequenceBuildDiagnostics(() => ({ pendingChanges: ['value.js'] }))
  const failure = new Error('delivery failed')
  await expect(diagnostics.wait('patch-delivery', async () => {
    throw failure
  })).rejects.toBe(failure)
  expect(diagnostics.snapshot()).toMatchObject({
    pending: [],
    events: [
      { phase: 'patch-delivery', status: 'started' },
      { phase: 'patch-delivery', status: 'failed' },
    ],
  })
})
