export type RuntimeExecutionMode = 'compat' | 'safe' | 'strict'

let currentRuntimeExecutionMode: RuntimeExecutionMode = 'compat'
const warnedMessages = new Set<string>()

function isRuntimeExecutionMode(value: unknown): value is RuntimeExecutionMode {
  return value === 'compat' || value === 'safe' || value === 'strict'
}

export function getRuntimeExecutionMode(): RuntimeExecutionMode {
  return currentRuntimeExecutionMode
}

export function setRuntimeExecutionMode(mode?: RuntimeExecutionMode | string) {
  if (mode === undefined) {
    currentRuntimeExecutionMode = 'compat'
    warnedMessages.clear()
    return
  }
  if (isRuntimeExecutionMode(mode)) {
    currentRuntimeExecutionMode = mode
    warnedMessages.clear()
    return
  }
  warnRuntimeExecutionOnce(
    `invalid-runtime-mode:${String(mode)}`,
    `[@weapp-vite/web] 未知 executionMode "${String(mode)}"，已回退到 compat。`,
  )
  currentRuntimeExecutionMode = 'compat'
}

export function warnRuntimeExecutionOnce(key: string, message: string) {
  if (warnedMessages.has(key)) {
    return
  }
  warnedMessages.add(key)
  if (typeof console !== 'undefined' && typeof console.warn === 'function') {
    console.warn(message)
  }
}
