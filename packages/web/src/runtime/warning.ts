export type RuntimeWarningLevel = 'off' | 'warn' | 'error'

export interface RuntimeWarningOptions {
  level?: RuntimeWarningLevel
  dedupe?: boolean
}

interface RuntimeWarningEmitOptions {
  key?: string
  context?: string
  level?: RuntimeWarningLevel
}

const defaultWarningOptions: Required<RuntimeWarningOptions> = {
  level: 'warn',
  dedupe: true,
}

let runtimeWarningOptions: Required<RuntimeWarningOptions> = {
  ...defaultWarningOptions,
}

const warnedKeys = new Set<string>()

function withContext(message: string, context?: string) {
  if (!context) {
    return message
  }
  if (message.startsWith('[@weapp-vite/web]')) {
    return message.replace('[@weapp-vite/web]', `[@weapp-vite/web][${context}]`)
  }
  return `[@weapp-vite/web][${context}] ${message}`
}

function getConsole() {
  return (globalThis as { console?: Console }).console
}

export function setRuntimeWarningOptions(options?: RuntimeWarningOptions) {
  runtimeWarningOptions = {
    ...defaultWarningOptions,
    ...(options ?? {}),
  }
  warnedKeys.clear()
}

export function emitRuntimeWarning(message: string, options: RuntimeWarningEmitOptions = {}) {
  const level = options.level ?? runtimeWarningOptions.level
  if (level === 'off') {
    return
  }

  const key = options.key
  if (runtimeWarningOptions.dedupe && key) {
    if (warnedKeys.has(key)) {
      return
    }
    warnedKeys.add(key)
  }

  const logger = getConsole()
  if (!logger) {
    return
  }
  const normalized = withContext(message, options.context)
  if (level === 'error' && typeof logger.error === 'function') {
    logger.error(normalized)
    return
  }
  if (typeof logger.warn === 'function') {
    logger.warn(normalized)
  }
}
