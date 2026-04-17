import type { SetDataSnapshotOptions } from '../types'
import { getCurrentMiniProgramHostConfig, getMiniProgramGlobalObject } from '../platform'

interface ResolvedHighFrequencyWarningOptions {
  enabled: boolean
  devOnly: boolean
  sampleWindowMs: number
  maxCalls: number
  coolDownMs: number
  warnOnPageScroll: boolean
  pageScrollCoolDownMs: number
}

interface CreateHighFrequencyWarningMonitorOptions {
  option: SetDataSnapshotOptions['highFrequencyWarning']
  targetLabel: string
  isInPageScrollHook?: () => boolean
  now?: () => number
  logger?: (message: string) => void
}

function isObject(value: unknown): value is Record<string, any> {
  return !!value && typeof value === 'object' && !Array.isArray(value)
}

/**
 * 解析 setData 高频告警配置。
 */
export function resolveHighFrequencyWarningOptions(
  option: SetDataSnapshotOptions['highFrequencyWarning'],
): ResolvedHighFrequencyWarningOptions {
  const defaults = {
    devOnly: true,
    sampleWindowMs: 1000,
    maxCalls: 30,
    coolDownMs: 5000,
    warnOnPageScroll: true,
    pageScrollCoolDownMs: 2000,
  }

  if (option === undefined || option === false) {
    return {
      ...defaults,
      enabled: false,
    }
  }
  if (option === true) {
    return {
      ...defaults,
      enabled: true,
    }
  }
  if (!isObject(option)) {
    return {
      ...defaults,
      enabled: false,
    }
  }
  return {
    enabled: option.enabled ?? true,
    devOnly: option.devOnly ?? defaults.devOnly,
    sampleWindowMs: typeof option.sampleWindowMs === 'number'
      ? Math.max(100, Math.floor(option.sampleWindowMs))
      : defaults.sampleWindowMs,
    maxCalls: typeof option.maxCalls === 'number'
      ? Math.max(1, Math.floor(option.maxCalls))
      : defaults.maxCalls,
    coolDownMs: typeof option.coolDownMs === 'number'
      ? Math.max(0, Math.floor(option.coolDownMs))
      : defaults.coolDownMs,
    warnOnPageScroll: option.warnOnPageScroll ?? defaults.warnOnPageScroll,
    pageScrollCoolDownMs: typeof option.pageScrollCoolDownMs === 'number'
      ? Math.max(0, Math.floor(option.pageScrollCoolDownMs))
      : defaults.pageScrollCoolDownMs,
  }
}

/**
 * 判断当前是否为开发态运行环境。
 */
export function isDevelopmentRuntime(): boolean {
  const miniProgramHostConfig = getCurrentMiniProgramHostConfig()
  if (miniProgramHostConfig?.debug === true || miniProgramHostConfig?.envVersion === 'develop') {
    return true
  }

  const miniProgramGlobal = getMiniProgramGlobalObject()
  try {
    const envVersion = miniProgramGlobal?.getAccountInfoSync?.()?.miniProgram?.envVersion
    if (envVersion === 'develop') {
      return true
    }
  }
  catch {
    // 忽略运行环境不支持 getAccountInfoSync 的异常
  }

  return false
}

/**
 * 创建 setData 高频调用告警监视器。
 */
export function createSetDataHighFrequencyWarningMonitor(
  options: CreateHighFrequencyWarningMonitorOptions,
) {
  const resolved = resolveHighFrequencyWarningOptions(options.option)
  if (!resolved.enabled) {
    return undefined
  }

  const isDev = isDevelopmentRuntime()
  if (resolved.devOnly && !isDev) {
    return undefined
  }

  const now = options.now ?? (() => Date.now())
  const logger = options.logger ?? ((message: string) => {
    const runtimeConsoleWarn = (globalThis as Record<string, any>)?.console?.warn
    if (typeof runtimeConsoleWarn === 'function') {
      runtimeConsoleWarn(message)
    }
  })

  const callTimes: number[] = []
  let lastWarnAt = Number.NEGATIVE_INFINITY
  let lastPageScrollWarnAt = Number.NEGATIVE_INFINITY

  return () => {
    const current = now()
    callTimes.push(current)

    const windowStart = current - resolved.sampleWindowMs
    while (callTimes.length > 0 && callTimes[0] < windowStart) {
      callTimes.shift()
    }

    const inPageScrollHook = options.isInPageScrollHook?.() ?? false
    if (resolved.warnOnPageScroll && inPageScrollHook) {
      if (resolved.pageScrollCoolDownMs <= 0 || current - lastPageScrollWarnAt >= resolved.pageScrollCoolDownMs) {
        lastPageScrollWarnAt = current
        logger(
          `[wevu:setData] 检测到 onPageScroll 回调内调用 setData（${options.targetLabel}）。建议改用 IntersectionObserver 监听可见性，或对滚动更新做节流。`,
        )
      }
    }

    if (callTimes.length <= resolved.maxCalls) {
      return
    }
    if (resolved.coolDownMs > 0 && current - lastWarnAt < resolved.coolDownMs) {
      return
    }
    lastWarnAt = current

    logger(
      `[wevu:setData] 检测到高频 setData 调用：${callTimes.length} 次/${resolved.sampleWindowMs}ms（${options.targetLabel}）。建议合并更新或降低调用频率。`,
    )
  }
}
