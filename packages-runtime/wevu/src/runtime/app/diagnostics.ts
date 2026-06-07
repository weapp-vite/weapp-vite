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
    const bytes = typeof info.bytes === 'number' ? info.bytes : info.estimatedBytes
    const bytesText = typeof bytes === 'number' ? `${bytes}B` : 'unknown'
    const parts = [
      `mode=${info.mode}`,
      `reason=${info.reason}`,
      `pending=${info.pendingPatchKeys}`,
      `keys=${info.payloadKeys}`,
      `bytes=${bytesText}`,
    ]
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
