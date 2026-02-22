import process from 'node:process'
import cmpVersion from 'licia/cmpVersion'
import automator from 'miniprogram-automator'
import MiniProgram from 'miniprogram-automator/out/MiniProgram.js'

const MIN_SDK_VERSION = '2.7.3'
const DEFAULT_LIB_VERSION = '3.13.2'
const DEVTOOLS_HTTP_PORT_ERROR = 'Failed to launch wechat web devTools, please make sure http port is open'
const RUNTIME_LOG_META_KEY = '__weappViteRuntimeLogMeta'

let versionPatched = false

interface RuntimeLogStats {
  warn: number
  error: number
  exception: number
  total: number
}

interface RuntimeLogMeta {
  entries: string[]
  stats: RuntimeLogStats
  dispose: () => void
  closeWrapped: boolean
}

function resolveConsolePayload(entry: any) {
  if (entry && typeof entry === 'object' && entry.entry && typeof entry.entry === 'object') {
    return entry.entry
  }
  return entry
}

function normalizeConsoleText(entry: any) {
  const payload = resolveConsolePayload(entry)
  if (typeof payload?.text === 'string' && payload.text.trim()) {
    return payload.text.trim()
  }
  if (Array.isArray(payload?.args) && payload.args.length > 0) {
    const text = payload.args
      .map((item: any) => {
        const raw = item && typeof item === 'object' && 'value' in item ? item.value : item
        if (typeof raw === 'string') {
          return raw
        }
        try {
          return JSON.stringify(raw)
        }
        catch {
          return String(raw)
        }
      })
      .join(' ')
      .trim()
    if (text) {
      return text
    }
  }
  try {
    return JSON.stringify(entry)
  }
  catch {
    return String(entry)
  }
}

function isErrorConsoleEntry(entry: any) {
  const payload = resolveConsolePayload(entry)
  const level = String(payload?.level ?? '').toLowerCase()
  if (level === 'error' || level === 'fatal') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return /\b(?:TypeError|ReferenceError|SyntaxError|Error|RangeError)\b/.test(text)
}

function isWarnConsoleEntry(entry: any) {
  const payload = resolveConsolePayload(entry)
  const level = String(payload?.level ?? '').toLowerCase()
  if (level === 'warn' || level === 'warning') {
    return true
  }
  const text = normalizeConsoleText(entry)
  return /\b(?:warn(?:ing)?|deprecated|deprecation)\b/i.test(text)
    || /\[Component\]/.test(text)
}

function ensureRuntimeLogMeta(miniProgram: any): RuntimeLogMeta {
  const existing = (miniProgram as Record<string, any>)[RUNTIME_LOG_META_KEY] as RuntimeLogMeta | undefined
  if (existing) {
    return existing
  }

  const entries: string[] = []
  const stats: RuntimeLogStats = {
    warn: 0,
    error: 0,
    exception: 0,
    total: 0,
  }

  const onConsole = (entry: any) => {
    const text = normalizeConsoleText(entry)
    if (!text) {
      return
    }
    if (isErrorConsoleEntry(entry)) {
      stats.error += 1
      stats.total += 1
      entries.push(`[console:error] ${text}`)
      return
    }
    if (isWarnConsoleEntry(entry)) {
      stats.warn += 1
      stats.total += 1
      entries.push(`[console:warn] ${text}`)
    }
  }

  const onException = (entry: any) => {
    const text = typeof entry?.exceptionDetails?.text === 'string'
      ? entry.exceptionDetails.text
      : normalizeConsoleText(entry)
    stats.exception += 1
    stats.total += 1
    entries.push(`[exception] ${text}`)
  }

  miniProgram.on('console', onConsole)
  miniProgram.on('exception', onException)

  const meta: RuntimeLogMeta = {
    entries,
    stats,
    dispose() {
      miniProgram.removeListener('console', onConsole)
      miniProgram.removeListener('exception', onException)
    },
    closeWrapped: false,
  }

  ;(miniProgram as Record<string, any>)[RUNTIME_LOG_META_KEY] = meta
  return meta
}

function logRuntimeStats(meta: RuntimeLogMeta) {
  const summary = `[automator-runtime-stats] warn=${meta.stats.warn} error=${meta.stats.error} exception=${meta.stats.exception} total=${meta.stats.total}`
  if (meta.stats.total > 0) {
    process.stderr.write(`${summary}\n`)
    for (const entry of meta.entries) {
      process.stderr.write(`[automator-runtime-log] ${entry}\n`)
    }
    return
  }
  process.stdout.write(`${summary}\n`)
}

function enhanceMiniProgramWithRuntimeLogs(miniProgram: any) {
  const meta = ensureRuntimeLogMeta(miniProgram)
  if (meta.closeWrapped) {
    return miniProgram
  }
  meta.closeWrapped = true

  const rawClose = miniProgram.close.bind(miniProgram)
  miniProgram.close = async (...args: any[]) => {
    try {
      return await rawClose(...args)
    }
    finally {
      meta.dispose()
      logRuntimeStats(meta)
    }
  }

  return miniProgram
}

function patchAutomatorVersionCheck() {
  if (versionPatched) {
    return
  }
  versionPatched = true
  MiniProgram.prototype.checkVersion = async function checkVersionPatched(this: {
    send: (method: string) => Promise<{ SDKVersion?: string }>
  }) {
    const info = await this.send('Tool.getInfo')
    const sdkVersion = info?.SDKVersion
    if (!sdkVersion || sdkVersion === 'dev') {
      return
    }
    if (cmpVersion(sdkVersion, MIN_SDK_VERSION) < 0) {
      throw new Error(
        `SDKVersion is currently ${sdkVersion}, while automator requires at least version ${MIN_SDK_VERSION}`,
      )
    }
  }
}

export function launchAutomator(options: Parameters<typeof automator.launch>[0]) {
  patchAutomatorVersionCheck()
  const { projectConfig, timeout, ...rest } = options
  return automator.launch({
    ...rest,
    timeout: timeout ?? 90_000,
    projectConfig: {
      libVersion: DEFAULT_LIB_VERSION,
      ...projectConfig,
    },
  }).then(miniProgram => enhanceMiniProgramWithRuntimeLogs(miniProgram))
}

export function isDevtoolsHttpPortError(error: unknown) {
  const message = error instanceof Error ? error.message : String(error)
  return message.includes(DEVTOOLS_HTTP_PORT_ERROR)
}
