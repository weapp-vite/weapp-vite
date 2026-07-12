/* eslint-disable ts/no-use-before-define */

export interface StatefulHmrDelta {
  code: string
  version: number
}

export interface StatefulHmrBatch {
  buildId: string
  deltas: StatefulHmrDelta[]
  fromVersion: number
  sessionId: string
  targetVersion: number
}

export interface StatefulHmrServerState {
  activeSessionId?: string
  buildId: string
  deltas: StatefulHmrDelta[]
  hostVersion: number
  inFlight?: Pick<StatefulHmrBatch, 'fromVersion' | 'sessionId' | 'targetVersion'>
  retainedDeltaBytes: number
  retiredSessionIds: string[]
}

export type StatefulHmrServerEvent
  = | { type: 'delta-added', bytes: number, code: string }
    | { type: 'client-registered', buildId: string, sessionId: string, version: number }
    | { type: 'client-reported', buildId: string, sessionId: string, version: number }
    | { type: 'batch-publish-failed', sessionId: string, targetVersion: number }
    | { type: 'full-build-committed', buildId: string }

export type StatefulHmrFullBuildReason
  = | 'client-version-ahead'
    | 'invalid-client-version'
    | 'missing-delta-history'

export type StatefulHmrServerCommand
  = | { type: 'publish-batch', batch: StatefulHmrBatch }
    | { type: 'request-full-build', reason: StatefulHmrFullBuildReason }
    | { type: 'ignore-client', reason: 'retired-session' | 'stale-build' | 'unknown-session' }

export interface StatefulHmrServerTransition {
  commands: StatefulHmrServerCommand[]
  state: StatefulHmrServerState
}

export function createStatefulHmrServerState(buildId: string): StatefulHmrServerState {
  return {
    buildId,
    deltas: [],
    hostVersion: 0,
    retainedDeltaBytes: 0,
    retiredSessionIds: [],
  }
}

export function transitionStatefulHmrServer(
  state: StatefulHmrServerState,
  event: StatefulHmrServerEvent,
): StatefulHmrServerTransition {
  switch (event.type) {
    case 'delta-added': {
      const version = state.hostVersion + 1
      return unchanged({
        ...state,
        deltas: [...state.deltas, { code: event.code, version }],
        hostVersion: version,
        retainedDeltaBytes: state.retainedDeltaBytes + event.bytes,
      })
    }
    case 'client-registered':
      return registerClient(state, event)
    case 'client-reported':
      return reportClient(state, event)
    case 'batch-publish-failed':
      if (state.inFlight?.sessionId !== event.sessionId || state.inFlight.targetVersion !== event.targetVersion) {
        return unchanged(state)
      }
      return unchanged({ ...state, inFlight: undefined })
    case 'full-build-committed':
      return unchanged(createStatefulHmrServerState(event.buildId))
  }
}

function registerClient(
  state: StatefulHmrServerState,
  client: { buildId: string, sessionId: string, version: number },
): StatefulHmrServerTransition {
  const rejected = rejectClient(state, client)
  if (rejected) {
    return rejected
  }
  if (state.retiredSessionIds.includes(client.sessionId)) {
    return withCommand(state, { type: 'ignore-client', reason: 'retired-session' })
  }
  if (state.activeSessionId === client.sessionId) {
    return unchanged(state)
  }
  const retiredSessionIds = state.activeSessionId
    ? [...new Set([...state.retiredSessionIds, state.activeSessionId])]
    : state.retiredSessionIds
  return unchanged({
    ...state,
    activeSessionId: client.sessionId,
    inFlight: undefined,
    retiredSessionIds,
  })
}

function reportClient(
  state: StatefulHmrServerState,
  client: { buildId: string, sessionId: string, version: number },
): StatefulHmrServerTransition {
  const rejected = rejectClient(state, client)
  if (rejected) {
    return rejected
  }
  if (state.retiredSessionIds.includes(client.sessionId)) {
    return withCommand(state, { type: 'ignore-client', reason: 'retired-session' })
  }
  if (client.sessionId !== state.activeSessionId) {
    return withCommand(state, { type: 'ignore-client', reason: 'unknown-session' })
  }
  return synchronizeClient(state, client.version)
}

function rejectClient(
  state: StatefulHmrServerState,
  client: { buildId: string, version: number },
): StatefulHmrServerTransition | undefined {
  if (client.buildId !== state.buildId) {
    return withCommand(state, { type: 'ignore-client', reason: 'stale-build' })
  }
  if (!Number.isInteger(client.version) || client.version < 0) {
    return withCommand(state, { type: 'request-full-build', reason: 'invalid-client-version' })
  }
  if (client.version > state.hostVersion) {
    return withCommand(state, { type: 'request-full-build', reason: 'client-version-ahead' })
  }
}

function synchronizeClient(state: StatefulHmrServerState, clientVersion: number): StatefulHmrServerTransition {
  let synchronized = state
  if (state.inFlight) {
    if (clientVersion === state.inFlight.fromVersion) {
      return publishMissingRange(state, clientVersion, state.inFlight.targetVersion)
    }
    if (clientVersion !== state.inFlight.targetVersion) {
      return withCommand(state, { type: 'request-full-build', reason: 'invalid-client-version' })
    }
    synchronized = { ...state, inFlight: undefined }
  }
  if (clientVersion >= synchronized.hostVersion) {
    return unchanged(synchronized)
  }
  return publishMissingRange(synchronized, clientVersion, synchronized.hostVersion, true)
}

function publishMissingRange(
  state: StatefulHmrServerState,
  fromVersion: number,
  targetVersion: number,
  trackInFlight = false,
): StatefulHmrServerTransition {
  const deltas = state.deltas.filter(delta => delta.version > fromVersion && delta.version <= targetVersion)
  if (deltas.length !== targetVersion - fromVersion) {
    return withCommand(state, { type: 'request-full-build', reason: 'missing-delta-history' })
  }
  const batch: StatefulHmrBatch = {
    buildId: state.buildId,
    deltas,
    fromVersion,
    sessionId: state.activeSessionId!,
    targetVersion,
  }
  const nextState = trackInFlight
    ? {
        ...state,
        inFlight: {
          fromVersion,
          sessionId: batch.sessionId,
          targetVersion,
        },
      }
    : state
  return withCommand(nextState, { type: 'publish-batch', batch })
}

function unchanged(state: StatefulHmrServerState): StatefulHmrServerTransition {
  return { commands: [], state }
}

function withCommand(state: StatefulHmrServerState, command: StatefulHmrServerCommand): StatefulHmrServerTransition {
  return { commands: [command], state }
}
