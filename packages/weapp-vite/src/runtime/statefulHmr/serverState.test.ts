import { describe, expect, it } from 'vitest'
import { createStatefulHmrServerState, transitionStatefulHmrServer } from './serverState'

function register(buildId = 'build-a', sessionId = 'session-a') {
  const initial = createStatefulHmrServerState(buildId)
  return transitionStatefulHmrServer(initial, {
    type: 'client-registered',
    buildId,
    sessionId,
    version: 0,
  }).state
}

describe('stateful hmr server state', () => {
  it('publishes the complete missing range and waits for acknowledgement', () => {
    let state = register()
    state = transitionStatefulHmrServer(state, { type: 'delta-added', bytes: 1, code: 'a' }).state
    state = transitionStatefulHmrServer(state, { type: 'delta-added', bytes: 2, code: 'bb' }).state

    const publish = transitionStatefulHmrServer(state, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: 0,
    })

    expect(publish.commands).toEqual([{
      type: 'publish-batch',
      batch: {
        buildId: 'build-a',
        deltas: [
          { code: 'a', version: 1 },
          { code: 'bb', version: 2 },
        ],
        fromVersion: 0,
        sessionId: 'session-a',
        targetVersion: 2,
      },
    }])
    expect(publish.state.inFlight).toEqual({
      fromVersion: 0,
      sessionId: 'session-a',
      targetVersion: 2,
    })

    const acknowledged = transitionStatefulHmrServer(publish.state, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: 2,
    })
    expect(acknowledged.commands).toEqual([])
    expect(acknowledged.state.inFlight).toBeUndefined()
  })

  it('republishes an unacknowledged range and queues later deltas', () => {
    let state = register()
    state = transitionStatefulHmrServer(state, { type: 'delta-added', bytes: 1, code: 'a' }).state
    state = transitionStatefulHmrServer(state, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: 0,
    }).state
    state = transitionStatefulHmrServer(state, { type: 'delta-added', bytes: 1, code: 'b' }).state

    const retry = transitionStatefulHmrServer(state, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: 0,
    })
    expect(retry.commands[0]).toMatchObject({
      type: 'publish-batch',
      batch: { fromVersion: 0, targetVersion: 1 },
    })

    const next = transitionStatefulHmrServer(retry.state, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: 1,
    })
    expect(next.commands[0]).toMatchObject({
      type: 'publish-batch',
      batch: { fromVersion: 1, targetVersion: 2 },
    })
  })

  it('retires the previous App Service session', () => {
    const first = register()
    const second = transitionStatefulHmrServer(first, {
      type: 'client-registered',
      buildId: 'build-a',
      sessionId: 'session-b',
      version: 0,
    }).state

    expect(second.activeSessionId).toBe('session-b')
    expect(second.retiredSessionIds).toEqual(['session-a'])
    expect(transitionStatefulHmrServer(second, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: 0,
    }).commands).toEqual([{ type: 'ignore-client', reason: 'retired-session' }])
  })

  it('rejects stale builds and invalid versions deterministically', () => {
    const state = register()
    expect(transitionStatefulHmrServer(state, {
      type: 'client-reported',
      buildId: 'build-old',
      sessionId: 'session-a',
      version: 0,
    }).commands).toEqual([{ type: 'ignore-client', reason: 'stale-build' }])
    expect(transitionStatefulHmrServer(state, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: -1,
    }).commands).toEqual([{ type: 'request-full-build', reason: 'invalid-client-version' }])
    expect(transitionStatefulHmrServer(state, {
      type: 'client-reported',
      buildId: 'build-a',
      sessionId: 'session-a',
      version: 1,
    }).commands).toEqual([{ type: 'request-full-build', reason: 'client-version-ahead' }])
  })

  it('resets all retained state after a full build epoch change', () => {
    let state = register()
    state = transitionStatefulHmrServer(state, { type: 'delta-added', bytes: 4, code: 'test' }).state
    const reset = transitionStatefulHmrServer(state, { type: 'full-build-committed', buildId: 'build-b' })
    expect(reset.state).toEqual(createStatefulHmrServerState('build-b'))
  })
})
