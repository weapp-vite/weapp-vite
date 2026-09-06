import type { MiniProgramAdapter, SetDataDebugInfo } from '../../types'
import { cloneSnapshotValue } from './snapshot'

export type SetDataSnapshot = Record<string, unknown>
export type SetDataPayload = Record<string, unknown>
export type SetDataMode = 'diff' | 'patch'
export type SetDataRevisionKind = 'delta' | 'full'
export type SetDataAdapterSettlement = 'committed' | 'failed' | 'abandoned'

export type SetDataAdapterSettler = (
  settlement: SetDataAdapterSettlement,
  cause?: unknown,
) => void

export interface CommitAwareSetDataAdapter extends MiniProgramAdapter {
  __wevu_dispatchSetData?: (
    payload: SetDataPayload,
    settle: SetDataAdapterSettler,
  ) => void
  __wevu_reportSetDataError?: (error: Error) => void
  __wevu_disposeSetData?: () => void
}

export interface PreparedSetDataUpdate {
  mode: SetDataMode
  kind: SetDataRevisionKind
  reason: SetDataDebugInfo['reason']
  snapshot: SetDataSnapshot
  payload: SetDataPayload
  pendingPatchKeys: number
}

export interface SetDataCommitFailure {
  kind: 'adapter' | 'out-of-order'
  revision: number
  committedRevision: number
  mode: SetDataMode
  cause: unknown
  error: Error
  payloadKeys: number
  pendingPatchKeys: number
}

export interface SetDataCommitState {
  preparedSnapshot: SetDataSnapshot
  dispatchedSnapshot: SetDataSnapshot
  committedSnapshot: SetDataSnapshot
  revision: number
  committedRevision: number
  failedRevision: number | undefined
  needsFullSnapshot: boolean
  commitPromise: Promise<void>
  disposed: boolean
}

export interface SetDataCommitTracker {
  readonly state: SetDataCommitState
  dispatch: (update: PreparedSetDataUpdate) => number
  createFullPayload: (snapshot: SetDataSnapshot) => SetDataPayload
  dispose: () => void
}

type RevisionStatus = 'dispatched' | 'succeeded' | 'failed' | 'abandoned'

interface RevisionRecord {
  revision: number
  epoch: number
  mode: SetDataMode
  kind: SetDataRevisionKind
  snapshot: SetDataSnapshot
  payloadKeys: number
  pendingPatchKeys: number
  status: RevisionStatus
  physicalSettled: boolean
  inLedger: boolean
  next: RevisionRecord | undefined
  commitPromise?: Promise<void>
  resolveCommit?: () => void
}

const resolvedCommitPromise = Promise.resolve()

function isThenable(value: unknown): value is PromiseLike<unknown> {
  return Boolean(
    value
    && (typeof value === 'object' || typeof value === 'function')
    && typeof (value as PromiseLike<unknown>).then === 'function',
  )
}

function formatCommitFailureCause(cause: unknown): string {
  try {
    return cause instanceof Error ? cause.message : String(cause)
  }
  catch {
    return '<unprintable cause>'
  }
}

function createCommitError(
  kind: SetDataCommitFailure['kind'],
  record: RevisionRecord,
  cause: unknown,
) {
  const causeMessage = formatCommitFailureCause(cause)
  const label = kind === 'adapter' ? 'adapter failure' : 'out-of-order completion'
  const error = new Error(
    `[wevu] setData commit failed (${label}, revision=${record.revision}, mode=${record.mode}, kind=${record.kind}): ${causeMessage}`,
  )
  ;(error as Error & { cause?: unknown }).cause = cause
  return error
}

export function observeSetDataCompletion(options: {
  invoke: (callback: () => void) => unknown
  completion: 'return' | 'callback'
  settle: SetDataAdapterSettler
}): void {
  let settled = false
  let invoking = true
  let callbackCalled = false
  let returnIsAuthoritative = false
  const settleOnce: SetDataAdapterSettler = (settlement, cause) => {
    if (settled) {
      return
    }
    settled = true
    options.settle(settlement, cause)
  }
  const callback = () => {
    if (invoking) {
      callbackCalled = true
      return
    }
    if (returnIsAuthoritative) {
      return
    }
    if (options.completion === 'callback') {
      settleOnce('committed')
    }
  }

  try {
    const result = options.invoke(callback)
    const resultIsThenable = isThenable(result)
    returnIsAuthoritative = resultIsThenable
    invoking = false
    if (resultIsThenable) {
      result.then(
        () => settleOnce('committed'),
        cause => settleOnce('failed', cause),
      )
      return
    }
    if (options.completion === 'return' || callbackCalled) {
      settleOnce('committed')
    }
  }
  catch (cause) {
    invoking = false
    settleOnce('failed', cause)
  }
}

export function createSetDataCommitTracker(options: {
  initialSnapshot?: SetDataSnapshot
  adapter: CommitAwareSetDataAdapter
  onFailure: (failure: SetDataCommitFailure) => void
}): SetDataCommitTracker {
  const initialSnapshot = options.initialSnapshot ? cloneSnapshotValue(options.initialSnapshot) : {}
  const knownHostTopKeys = new Set(Object.keys(initialSnapshot))
  let epoch = 0
  let highestCompletedRevision = 0
  let head: RevisionRecord | undefined
  let tail: RevisionRecord | undefined

  function ensureCommitBarrier(record: RevisionRecord) {
    if (!record.inLedger) {
      return resolvedCommitPromise
    }
    if (!record.commitPromise) {
      record.commitPromise = new Promise<void>((resolve) => {
        record.resolveCommit = resolve
      })
    }
    return record.commitPromise
  }

  const state: SetDataCommitState = {
    preparedSnapshot: initialSnapshot,
    dispatchedSnapshot: initialSnapshot,
    committedSnapshot: initialSnapshot,
    revision: 0,
    committedRevision: 0,
    failedRevision: undefined,
    needsFullSnapshot: false,
    get commitPromise() {
      return tail ? ensureCommitBarrier(tail) : resolvedCommitPromise
    },
    disposed: false,
  }

  const reportFailure = (
    kind: SetDataCommitFailure['kind'],
    record: RevisionRecord,
    cause: unknown,
  ) => {
    const error = createCommitError(kind, record, cause)
    try {
      options.onFailure({
        kind,
        revision: record.revision,
        committedRevision: state.committedRevision,
        mode: record.mode,
        cause,
        error,
        payloadKeys: record.payloadKeys,
        pendingPatchKeys: record.pendingPatchKeys,
      })
    }
    catch {
      // 错误上报不得反向破坏提交状态机。
    }
  }

  const resolveRecord = (record: RevisionRecord) => {
    record.resolveCommit?.()
    record.resolveCommit = undefined
  }

  const removePrefixThrough = (last: RevisionRecord) => {
    let current = head
    while (current) {
      const next = current.next
      current.inLedger = false
      current.next = undefined
      resolveRecord(current)
      if (current === last) {
        head = next
        if (!head) {
          tail = undefined
        }
        return
      }
      current = next
    }
  }

  const invalidateLedger = () => {
    let current = head
    while (current) {
      const next = current.next
      current.inLedger = false
      current.next = undefined
      if (!current.physicalSettled) {
        current.status = 'abandoned'
      }
      resolveRecord(current)
      current = next
    }
    head = undefined
    tail = undefined
    epoch += 1
    highestCompletedRevision = state.committedRevision
  }

  const armRecovery = () => {
    state.needsFullSnapshot = true
  }

  const failLineage = (
    kind: SetDataCommitFailure['kind'],
    record: RevisionRecord,
    cause: unknown,
  ) => {
    record.status = 'failed'
    state.failedRevision = record.revision
    armRecovery()
    invalidateLedger()
    reportFailure(kind, record, cause)
  }

  const drainSucceededPrefix = () => {
    while (head?.status === 'succeeded') {
      const record = head
      state.committedSnapshot = record.snapshot
      state.committedRevision = record.revision
      head = record.next
      record.inLedger = false
      record.next = undefined
      resolveRecord(record)
    }
    if (!head) {
      tail = undefined
    }
  }

  const commitFullCheckpoint = (record: RevisionRecord) => {
    state.committedSnapshot = record.snapshot
    state.committedRevision = record.revision
    state.failedRevision = undefined
    state.needsFullSnapshot = false
    removePrefixThrough(record)
    drainSucceededPrefix()
  }

  const handleLateSettlement = (
    record: RevisionRecord,
    settlement: SetDataAdapterSettlement,
    cause: unknown,
  ) => {
    if (settlement === 'failed') {
      reportFailure('adapter', record, cause)
      return
    }
    if (settlement === 'committed' && state.committedRevision > record.revision) {
      if (head) {
        invalidateLedger()
      }
      armRecovery()
      reportFailure(
        'out-of-order',
        record,
        `revision ${record.revision} completed after committed revision ${state.committedRevision}`,
      )
    }
  }

  const settleRecord = (
    record: RevisionRecord,
    settlement: SetDataAdapterSettlement,
    cause?: unknown,
  ) => {
    if (state.disposed || record.physicalSettled) {
      return
    }
    record.physicalSettled = true

    if (!record.inLedger || record.epoch !== epoch) {
      handleLateSettlement(record, settlement, cause)
      return
    }

    if (settlement === 'abandoned') {
      record.status = 'abandoned'
      armRecovery()
      invalidateLedger()
      return
    }
    if (settlement === 'failed') {
      failLineage('adapter', record, cause)
      return
    }

    record.status = 'succeeded'
    if (highestCompletedRevision > record.revision) {
      failLineage(
        'out-of-order',
        record,
        `revision ${record.revision} completed after revision ${highestCompletedRevision}`,
      )
      return
    }
    highestCompletedRevision = record.revision

    if (record.kind === 'full') {
      commitFullCheckpoint(record)
      return
    }
    drainSucceededPrefix()
  }

  const createFullPayload = (snapshot: SetDataSnapshot): SetDataPayload => {
    const payload: SetDataPayload = {}
    const snapshotKeys = new Set(Object.keys(snapshot))
    for (const [key, value] of Object.entries(snapshot)) {
      payload[key] = value === undefined ? null : value
    }
    for (const key of knownHostTopKeys) {
      if (!snapshotKeys.has(key)) {
        payload[key] = null
      }
    }
    return payload
  }

  const dispatch = (update: PreparedSetDataUpdate) => {
    if (state.disposed) {
      return state.revision
    }

    const revision = state.revision + 1
    state.revision = revision
    state.preparedSnapshot = update.snapshot
    const record: RevisionRecord = {
      revision,
      epoch,
      mode: update.mode,
      kind: update.kind,
      snapshot: update.snapshot,
      payloadKeys: Object.keys(update.payload).length,
      pendingPatchKeys: update.pendingPatchKeys,
      status: 'dispatched',
      physicalSettled: false,
      inLedger: true,
      next: undefined,
    }
    if (tail) {
      tail.next = record
    }
    else {
      head = record
    }
    tail = record
    state.dispatchedSnapshot = update.snapshot
    for (const key of Object.keys(update.payload)) {
      knownHostTopKeys.add(key.split('.', 1)[0]!)
    }

    const settle: SetDataAdapterSettler = (settlement, cause) => {
      settleRecord(record, settlement, cause)
    }
    if (typeof options.adapter.__wevu_dispatchSetData === 'function') {
      try {
        options.adapter.__wevu_dispatchSetData(update.payload, settle)
      }
      catch (cause) {
        settle('failed', cause)
      }
    }
    else {
      observeSetDataCompletion({
        invoke: () => options.adapter.setData?.(update.payload),
        completion: 'return',
        settle,
      })
    }
    return revision
  }

  const dispose = () => {
    if (state.disposed) {
      return
    }
    state.disposed = true
    invalidateLedger()
  }

  return {
    state,
    dispatch,
    createFullPayload,
    dispose,
  }
}
