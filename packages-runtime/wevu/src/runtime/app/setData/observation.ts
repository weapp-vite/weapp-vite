import type { SetDataDebugInfo } from '../../types'
import type { PreparedSetDataUpdate } from './commitTracker'

type Phase = NonNullable<SetDataDebugInfo['phase']>
export type SetDataCompletionBoundary = Phase['completion']

export interface PhysicalSetDataObserver {
  dispatch: (dispatch: NonNullable<Phase['dispatch']>) => void
  returned: (returnedAt: number) => void
  complete: (boundary: SetDataCompletionBoundary) => void
}

export interface SetDataRevisionObservation {
  physical: PhysicalSetDataObserver
  finish: (result: Phase['result']) => void
}

let nextObserverId = 0
let nextDispatchId = 0

function duration(start: number | null, end: number): number | null {
  return start !== null && end >= start ? end - start : null
}

function payloadBytes(payload: Record<string, unknown>): number | null {
  try {
    const json = JSON.stringify(payload)
    let bytes = 0
    for (let index = 0; index < json.length; index++) {
      const code = json.charCodeAt(index)
      if (code < 0x80) {
        bytes += 1
      }
      else if (code < 0x800) {
        bytes += 2
      }
      else if (code >= 0xD800 && code <= 0xDBFF && json.charCodeAt(index + 1) >= 0xDC00 && json.charCodeAt(index + 1) <= 0xDFFF) {
        bytes += 4
        index += 1
      }
      else {
        bytes += 3
      }
    }
    return bytes
  }
  catch {
    return null
  }
}

export function observePhysicalDispatch(observer: PhysicalSetDataObserver, payload: Record<string, unknown>) {
  // 只在观测启用时序列化；耗时从字节测量之后开始，避免将测量成本计入宿主提交。
  const bytes = payloadBytes(payload)
  observer.dispatch({ id: ++nextDispatchId, startedAt: Date.now(), payloadBytes: bytes, returnedAt: null, durationMs: null })
}

export function createSetDataObservation(options: {
  debug: (info: SetDataDebugInfo) => void
  debugWhen: 'fallback' | 'always'
  debugSampleRate: number
  targetLabel?: string
  committedRevision: () => number
}) {
  const observerId = ++nextObserverId
  let prepareStartedAt: number | null = null
  return {
    prepare() {
      prepareStartedAt = Date.now()
    },
    revision(update: PreparedSetDataUpdate, revision: number): SetDataRevisionObservation | undefined {
      const startedAt = prepareStartedAt
      prepareStartedAt = null
      if (options.debugWhen === 'fallback' && (update.reason === 'patch' || update.reason === 'diff')) {
        return
      }
      if (options.debugSampleRate <= 0 || (options.debugSampleRate < 1 && Math.random() >= options.debugSampleRate)) {
        return
      }
      const preparedAt = Date.now()
      let dispatch: Phase['dispatch'] = null
      let completion: SetDataCompletionBoundary = 'unknown'
      const base = {
        mode: update.mode,
        reason: update.reason,
        pendingPatchKeys: update.pendingPatchKeys,
        payloadKeys: Object.keys(update.payload).length,
        revision,
        targetLabel: options.targetLabel,
      }
      const emit = (name: Phase['name'], result: Phase['result'], settledAt: number | null = null) => {
        try {
          options.debug({
            ...base,
            committedRevision: options.committedRevision(),
            phase: {
              version: 1,
              observerId,
              name,
              result,
              completion,
              prepareStartedAt: startedAt,
              preparedAt,
              prepareDurationMs: duration(startedAt, preparedAt),
              settledAt,
              commitDurationMs: settledAt === null ? null : duration(dispatch?.startedAt ?? null, settledAt),
              visibleAt: null,
              dispatch: dispatch ? { ...dispatch } : null,
            },
          })
        }
        catch {
          // 消费者诊断异常不能影响调度或宿主提交。
        }
      }
      emit('prepare', 'prepared')
      return {
        physical: {
          dispatch(info) {
            dispatch = info
          },
          returned(returnedAt) {
            if (!dispatch) {
              return
            }
            dispatch = { ...dispatch, returnedAt, durationMs: duration(dispatch.startedAt, returnedAt) }
            emit('dispatch', 'pending')
          },
          complete(boundary) {
            if (dispatch || boundary === 'throw') {
              completion = boundary
            }
          },
        },
        finish(result) { emit('commit', result, Date.now()) },
      }
    },
  }
}
