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
    const message = `[wevu:setData] ${parts.join(' ')}`
    if (isFallbackReason(info.reason)) {
      console.warn(message)
      return
    }
    console.info(message)
  }
}
