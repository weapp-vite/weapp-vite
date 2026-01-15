import path from 'pathe'

const CJS_ERROR_PATTERNS = [
  '__dirname is not defined',
  '__filename is not defined',
  'require is not defined',
  'module is not defined',
  'exports is not defined',
  'es module scope',
] as const

function collectErrorText(error: unknown, texts: string[]): void {
  if (!error) {
    return
  }

  if (typeof error === 'string') {
    texts.push(error)
    return
  }

  if (typeof error === 'object') {
    const err = error as { message?: unknown, stack?: unknown, cause?: unknown }
    if (err.message) {
      texts.push(String(err.message))
    }
    if (err.stack) {
      texts.push(String(err.stack))
    }
    if ('cause' in err) {
      collectErrorText(err.cause, texts)
    }
  }
}

function formatConfigPath(configPath: string | undefined, cwd: string): string {
  if (!configPath) {
    return 'vite.config.ts'
  }

  const relative = path.relative(cwd, configPath)
  if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) {
    return relative
  }
  return configPath
}

export function createCjsConfigLoadError(options: {
  error: unknown
  configPath?: string
  cwd: string
}): Error | undefined {
  const texts: string[] = []
  collectErrorText(options.error, texts)
  const haystack = texts.join('\n').toLowerCase()
  const isCjsError = CJS_ERROR_PATTERNS.some(pattern => haystack.includes(pattern))
  if (!isCjsError) {
    return undefined
  }

  const target = formatConfigPath(options.configPath, options.cwd)
  const message = `${target} 为 CJS 格式，需要改为 ESM 写法（可参考 import.meta.dirname 等用法）。`
  const error = new Error(message)
  if (options.error instanceof Error) {
    ;(error as Error & { cause?: unknown }).cause = options.error
  }
  return error
}
