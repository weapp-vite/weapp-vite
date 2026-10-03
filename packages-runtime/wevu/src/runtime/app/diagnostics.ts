import type { SetDataDebugInfo } from '../types'

function isFallbackReason(reason: SetDataDebugInfo['reason']) {
  return reason !== 'patch' && reason !== 'diff'
}

export function createDiagnosticsLogger(mode: 'off' | 'fallback' | 'always') {
  if (mode === 'off') {
    return undefined
  }
  return (info: SetDataDebugInfo) => {
    if (mode === 'fallback' && !isFallbackReason(info.reason)) {
      return
    }
    const bytes = info.phase
      ? info.phase.dispatch?.payloadBytes
      : typeof info.bytes === 'number' ? info.bytes : info.estimatedBytes
    const bytesText = typeof bytes === 'number' ? `${bytes}B` : 'unknown'
    const parts = [
      `mode=${info.mode}`,
      `reason=${info.reason}`,
      `pending=${info.pendingPatchKeys}`,
      `keys=${info.payloadKeys}`,
      `bytes=${bytesText}`,
    ]
    if (typeof info.revision === 'number') {
      parts.push(`revision=${info.revision}`)
    }
    if (typeof info.committedRevision === 'number') {
      parts.push(`committedRevision=${info.committedRevision}`)
    }
    if (info.phase) {
      const phase = info.phase
      parts.push(
        `phase=${phase.name}`,
        `observer=${phase.observerId}`,
        `result=${phase.result}`,
        `completion=${phase.completion}`,
        `dispatch=${phase.dispatch?.id ?? 'unknown'}`,
        `prepareMs=${phase.prepareDurationMs ?? 'unknown'}`,
        `dispatchMs=${phase.dispatch?.durationMs ?? 'unknown'}`,
        `commitMs=${phase.commitDurationMs ?? 'unknown'}`,
        'visibleAt=unknown',
      )
    }
    if (typeof info.mergedSiblingParents === 'number') {
      parts.push(`mergedParents=${info.mergedSiblingParents}`)
    }
    if (typeof info.computedDirtyKeys === 'number') {
      parts.push(`computedDirty=${info.computedDirtyKeys}`)
    }
    if (typeof info.flushCount === 'number') {
      parts.push(`flushes=${info.flushCount}`)
    }
    if (typeof info.windowMs === 'number') {
      parts.push(`window=${info.windowMs}ms`)
    }
    if (info.targetLabel) {
      parts.push(`target=${info.targetLabel}`)
    }
    if (info.bindings?.length) {
      const bindings = info.bindings.map((binding) => {
        const start = binding.sourceLocation?.start
        return start
          ? `${binding.id}@${binding.sourceFile}:${start.line}:${start.column}`
          : `${binding.id}@${binding.sourceFile}`
      })
      parts.push(`bindings=${bindings.join(',')}`)
    }
    if (info.message) {
      parts.push(`message=${info.message}`)
    }
    const message = `[wevu:setData] ${parts.join(' ')}`
    if (isFallbackReason(info.reason)) {
      // eslint-disable-next-line no-console
      console.warn(message)
      return
    }
    // eslint-disable-next-line no-console
    console.info(message)
  }
}
