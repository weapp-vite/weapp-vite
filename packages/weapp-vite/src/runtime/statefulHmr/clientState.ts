/* eslint-disable ts/no-use-before-define */

export type StatefulHmrClientPhase = 'applying' | 'polling' | 'relaunching' | 'registering' | 'stopped'

export interface StatefulHmrClientState {
  buildId: string
  pendingBatch?: { fromVersion: number, targetVersion: number }
  phase: StatefulHmrClientPhase
  targetVersion?: number
  version: number
}

export type StatefulHmrClientEvent
  = | { type: 'started' }
    | { type: 'registration-completed' }
    | { type: 'poll-completed' }
    | { type: 'batch-observed', buildId: string, fromVersion: number, targetVersion: number }
    | { type: 'batch-executed', compatible: boolean, targetVersion: number }
    | { type: 'batch-failed' }
    | { type: 'route-ready' }
    | { type: 'transport-failed' }

export type StatefulHmrClientCommand
  = | { type: 'register', version: number }
    | { type: 'poll', version: number }
    | { type: 'apply-batch', fromVersion: number, targetVersion: number }
    | { type: 'report-version', reason: 'applied' | 'batch-mismatch', version: number }
    | { type: 'relaunch-route' }
    | { type: 'request-full-build', reason: 'batch-execution-failed' }
    | { type: 'retry-transport' }

export interface StatefulHmrClientTransition {
  commands: StatefulHmrClientCommand[]
  state: StatefulHmrClientState
}

export function createStatefulHmrClientState(buildId: string): StatefulHmrClientState {
  return { buildId, phase: 'stopped', version: 0 }
}

export function transitionStatefulHmrClient(
  state: StatefulHmrClientState,
  event: StatefulHmrClientEvent,
): StatefulHmrClientTransition {
  switch (event.type) {
    case 'started':
      return state.phase === 'stopped'
        ? withCommand({ ...state, phase: 'registering' }, { type: 'register', version: state.version })
        : unchanged(state)
    case 'registration-completed': {
      if (state.phase !== 'registering') {
        return unchanged(state)
      }
      if (!state.pendingBatch) {
        return withCommand({ ...state, phase: 'polling' }, { type: 'poll', version: state.version })
      }
      return withCommand(
        {
          ...state,
          pendingBatch: undefined,
          phase: 'applying',
          targetVersion: state.pendingBatch.targetVersion,
        },
        { type: 'apply-batch', ...state.pendingBatch },
      )
    }
    case 'poll-completed':
      return state.phase === 'polling'
        ? withCommand(state, { type: 'poll', version: state.version })
        : unchanged(state)
    case 'batch-observed':
      return observeBatch(state, event)
    case 'batch-executed':
      if (state.phase !== 'applying' || state.targetVersion !== event.targetVersion) {
        return withCommand(state, { type: 'report-version', reason: 'batch-mismatch', version: state.version })
      }
      if (!event.compatible) {
        return withCommand(
          { ...state, phase: 'relaunching', version: event.targetVersion },
          { type: 'relaunch-route' },
        )
      }
      return applied({ ...state, version: event.targetVersion })
    case 'batch-failed':
      return withCommand(
        { ...state, phase: 'polling', targetVersion: undefined },
        { type: 'request-full-build', reason: 'batch-execution-failed' },
      )
    case 'route-ready':
      return state.phase === 'relaunching' ? applied(state) : unchanged(state)
    case 'transport-failed':
      return withCommand(state, { type: 'retry-transport' })
  }
}

function observeBatch(
  state: StatefulHmrClientState,
  batch: { buildId: string, fromVersion: number, targetVersion: number },
): StatefulHmrClientTransition {
  const valid = batch.buildId === state.buildId
    && Number.isInteger(batch.fromVersion)
    && Number.isInteger(batch.targetVersion)
    && batch.fromVersion >= 0
    && batch.targetVersion > batch.fromVersion
  if (state.phase === 'registering') {
    if (!valid || batch.fromVersion !== state.version || batch.targetVersion <= state.version) {
      return unchanged(state)
    }
    return unchanged({
      ...state,
      pendingBatch: { fromVersion: batch.fromVersion, targetVersion: batch.targetVersion },
    })
  }
  if (!valid || state.phase !== 'polling' || batch.fromVersion !== state.version) {
    return withCommand(state, { type: 'report-version', reason: 'batch-mismatch', version: state.version })
  }
  if (batch.targetVersion <= state.version) {
    return withCommand(state, { type: 'report-version', reason: 'applied', version: state.version })
  }
  return withCommand(
    { ...state, phase: 'applying', targetVersion: batch.targetVersion },
    { type: 'apply-batch', fromVersion: batch.fromVersion, targetVersion: batch.targetVersion },
  )
}

function applied(state: StatefulHmrClientState): StatefulHmrClientTransition {
  return withCommand(
    { ...state, phase: 'polling', targetVersion: undefined },
    { type: 'report-version', reason: 'applied', version: state.version },
  )
}

function unchanged(state: StatefulHmrClientState): StatefulHmrClientTransition {
  return { commands: [], state }
}

function withCommand(state: StatefulHmrClientState, command: StatefulHmrClientCommand): StatefulHmrClientTransition {
  return { commands: [command], state }
}
