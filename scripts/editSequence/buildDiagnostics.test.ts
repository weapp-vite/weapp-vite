import { expect, it } from 'vitest'
import { SequenceBuildDiagnostics } from './buildDiagnostics'

it('bounds retained events and pending work without losing the latest observation state', () => {
  let revision = 1
  const diagnostics = new SequenceBuildDiagnostics(() => ({ revision }))
  const pendingEvents = Array.from({ length: 40 }, (_, index) => diagnostics.begin(`publication-${index}`))
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
  pendingEvents.forEach(event => diagnostics.end(event, 'completed'))
  expect(diagnostics.snapshot().pending).toEqual([])
  expect(diagnostics.snapshot().events).toHaveLength(32)
})

it('retains the failed boundary without clearing another pending operation', () => {
  const diagnostics = new SequenceBuildDiagnostics(() => ({ pendingChanges: ['value.js'] }))
  const delivery = diagnostics.begin('patch-delivery')
  const publication = diagnostics.begin('final-publication')
  diagnostics.end(delivery, 'failed')
  expect(diagnostics.snapshot()).toMatchObject({
    pending: [publication],
    events: [
      { phase: 'patch-delivery', status: 'started' },
      { phase: 'final-publication', status: 'started' },
      { phase: 'patch-delivery', status: 'failed' },
    ],
  })
  diagnostics.end(publication, 'completed')
  expect(diagnostics.snapshot().pending).toEqual([])
})
