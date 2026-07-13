import { describe, expect, it } from 'vitest'
import { createStatefulHmrClientState, transitionStatefulHmrClient } from './clientState'

function startPolling() {
  const started = transitionStatefulHmrClient(createStatefulHmrClientState('build-a'), { type: 'started' })
  return transitionStatefulHmrClient(started.state, { type: 'registration-completed' }).state
}

describe('stateful hmr client state', () => {
  it('registers once and keeps a single poll loop', () => {
    const initial = createStatefulHmrClientState('build-a')
    const started = transitionStatefulHmrClient(initial, { type: 'started' })
    expect(started.commands).toEqual([{ type: 'register', version: 0 }])
    expect(transitionStatefulHmrClient(started.state, { type: 'started' }).commands).toEqual([])

    const registered = transitionStatefulHmrClient(started.state, { type: 'registration-completed' })
    expect(registered.commands).toEqual([{ type: 'poll', version: 0 }])
    expect(transitionStatefulHmrClient(registered.state, { type: 'poll-completed' }).commands)
      .toEqual([{ type: 'poll', version: 0 }])
  })

  it('applies compatible batches before acknowledging them', () => {
    const polling = startPolling()
    const observed = transitionStatefulHmrClient(polling, {
      type: 'batch-observed',
      buildId: 'build-a',
      fromVersion: 0,
      targetVersion: 2,
    })
    expect(observed.commands).toEqual([{ type: 'apply-batch', fromVersion: 0, targetVersion: 2 }])

    const applied = transitionStatefulHmrClient(observed.state, {
      type: 'batch-executed',
      compatible: true,
      targetVersion: 2,
    })
    expect(applied.state).toMatchObject({ phase: 'polling', version: 2 })
    expect(applied.commands).toEqual([{ type: 'report-version', reason: 'applied', version: 2 }])
  })

  it('relaunches the current route before acknowledging incompatible batches', () => {
    const observed = transitionStatefulHmrClient(startPolling(), {
      type: 'batch-observed',
      buildId: 'build-a',
      fromVersion: 0,
      targetVersion: 1,
    })
    const executed = transitionStatefulHmrClient(observed.state, {
      type: 'batch-executed',
      compatible: false,
      targetVersion: 1,
    })
    expect(executed.state).toMatchObject({ phase: 'relaunching', version: 1 })
    expect(executed.commands).toEqual([{ type: 'relaunch-route' }])

    const ready = transitionStatefulHmrClient(executed.state, { type: 'route-ready' })
    expect(ready.state.phase).toBe('polling')
    expect(ready.commands).toEqual([{ type: 'report-version', reason: 'applied', version: 1 }])
  })

  it('queues a literal batch observed during registration', () => {
    const started = transitionStatefulHmrClient(createStatefulHmrClientState('build-a'), { type: 'started' })
    const observed = transitionStatefulHmrClient(started.state, {
      type: 'batch-observed',
      buildId: 'build-a',
      fromVersion: 0,
      targetVersion: 1,
    })
    expect(observed.state.pendingBatch).toEqual({ fromVersion: 0, targetVersion: 1 })

    const registered = transitionStatefulHmrClient(observed.state, { type: 'registration-completed' })
    expect(registered.commands).toEqual([{ type: 'apply-batch', fromVersion: 0, targetVersion: 1 }])
  })

  it('requests a full build after execution failure without advancing the version', () => {
    const observed = transitionStatefulHmrClient(startPolling(), {
      type: 'batch-observed',
      buildId: 'build-a',
      fromVersion: 0,
      targetVersion: 1,
    })
    const failed = transitionStatefulHmrClient(observed.state, { type: 'batch-failed' })
    expect(failed.state.version).toBe(0)
    expect(failed.commands).toEqual([{ type: 'request-full-build', reason: 'batch-execution-failed' }])
  })

  it('reports malformed, stale, and out-of-order batches without executing them', () => {
    const polling = startPolling()
    for (const batch of [
      { buildId: 'build-old', fromVersion: 0, targetVersion: 1 },
      { buildId: 'build-a', fromVersion: 1, targetVersion: 2 },
      { buildId: 'build-a', fromVersion: 0, targetVersion: 0 },
    ]) {
      expect(transitionStatefulHmrClient(polling, { type: 'batch-observed', ...batch }).commands)
        .toEqual([{ type: 'report-version', reason: 'batch-mismatch', version: 0 }])
    }
  })
})
