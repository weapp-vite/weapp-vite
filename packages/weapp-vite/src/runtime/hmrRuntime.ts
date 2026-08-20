import type { MpPlatform } from '../types'

export type HmrRuntime = 'classic' | 'stateful-experimental'
export type HmrRuntimeSetting = 'auto' | HmrRuntime | undefined
export type HmrRuntimeDecisionReason
  = | 'auto-classic'
    | 'auto-non-wechat'
    | 'auto-stateful'
    | 'explicit'
    | 'runtime-compatibility-fallback'
    | 'skyline-fallback'

export interface HmrRuntimeDecision {
  configured: Exclude<HmrRuntimeSetting, undefined>
  reason: HmrRuntimeDecisionReason
  runtime: HmrRuntime
}

interface HmrRuntimeOutputFile {
  fileName: string
  source?: unknown
  type: string
}

interface EmittedAppConfig {
  pages?: unknown
  renderer?: unknown
  subPackages?: unknown
  subpackages?: unknown
}

export function resolveHmrRuntimeDecision(options: {
  platform: MpPlatform
  configured?: HmrRuntimeSetting
  compileHotReLoad?: unknown
  skyline?: boolean
}): HmrRuntimeDecision {
  const configured = options.configured ?? 'auto'
  if (options.platform === 'weapp' && options.skyline === true) {
    return { configured, reason: 'skyline-fallback', runtime: 'classic' }
  }
  if (configured === 'classic' || configured === 'stateful-experimental') {
    return { configured, reason: 'explicit', runtime: configured }
  }
  if (options.platform === 'weapp' && options.compileHotReLoad === true) {
    return { configured, reason: 'auto-stateful', runtime: 'stateful-experimental' }
  }
  return {
    configured,
    reason: options.platform === 'weapp' ? 'auto-classic' : 'auto-non-wechat',
    runtime: 'classic',
  }
}

export function resolveHmrRuntime(options: Parameters<typeof resolveHmrRuntimeDecision>[0]): HmrRuntime {
  return resolveHmrRuntimeDecision(options).runtime
}

export function findSkylineRendererFiles(output: Iterable<HmrRuntimeOutputFile>): string[] {
  const jsonConfigs = new Map<string, Record<string, unknown>>()
  for (const item of output) {
    if (item.type !== 'asset' || !item.fileName.endsWith('.json')) {
      continue
    }
    const source = typeof item.source === 'string'
      ? item.source
      : item.source instanceof Uint8Array
        ? new TextDecoder().decode(item.source)
        : undefined
    if (!source) {
      continue
    }
    try {
      const config = JSON.parse(source) as unknown
      if (config && typeof config === 'object' && !Array.isArray(config)) {
        jsonConfigs.set(item.fileName.replaceAll('\\', '/'), config as Record<string, unknown>)
      }
    }
    catch {}
  }

  const appConfig = jsonConfigs.get('app.json') as EmittedAppConfig | undefined
  if (!appConfig) {
    return []
  }

  const configFiles = new Set(['app.json'])
  if (Array.isArray(appConfig.pages)) {
    for (const page of appConfig.pages) {
      if (typeof page === 'string') {
        configFiles.add(`${page}.json`)
      }
    }
  }
  const subPackages = Array.isArray(appConfig.subPackages)
    ? appConfig.subPackages
    : Array.isArray(appConfig.subpackages)
      ? appConfig.subpackages
      : []
  for (const subPackage of subPackages) {
    if (!subPackage || typeof subPackage !== 'object' || Array.isArray(subPackage)) {
      continue
    }
    const { pages, root } = subPackage as { pages?: unknown, root?: unknown }
    if (typeof root !== 'string' || !Array.isArray(pages)) {
      continue
    }
    const normalizedRoot = root.replaceAll('\\', '/').replace(/^\/+|\/+$/g, '')
    for (const page of pages) {
      if (typeof page === 'string') {
        configFiles.add(`${normalizedRoot}/${page}.json`)
      }
    }
  }

  return [...configFiles].filter(fileName => jsonConfigs.get(fileName)?.renderer === 'skyline')
}

export function formatHmrRuntimeStartupMessages(decision: HmrRuntimeDecision): [string, string] {
  if (decision.reason === 'skyline-fallback') {
    return [
      'HMR 模式：classic（自动降级：Skyline 暂不支持微信开发者工具热重载）',
      'HMR 切换：切回 WebView 后可手动重新开启微信开发者工具“热重载”。',
    ]
  }
  if (decision.reason === 'runtime-compatibility-fallback') {
    return [
      'HMR 模式：classic（自动降级：stateful HMR 运行时兼容性检查失败）',
      'HMR 切换：修复兼容性问题后重启 wv dev，或通过 weapp.hmr.runtime 显式配置 classic。',
    ]
  }
  if (decision.reason === 'explicit') {
    const alternative = decision.runtime === 'classic' ? 'stateful-experimental' : 'classic'
    return [
      `HMR 模式：${decision.runtime}（显式配置）`,
      `HMR 切换：修改 weapp.hmr.runtime 为 auto 或 ${alternative} 后重启 wv dev。`,
    ]
  }
  if (decision.reason === 'auto-non-wechat') {
    return [
      'HMR 模式：classic（自动检测：仅微信小程序支持 stateful-experimental）',
      'HMR 切换：可通过 weapp.hmr.runtime 显式配置 classic。',
    ]
  }
  if (decision.reason === 'auto-stateful') {
    return [
      'HMR 模式：stateful-experimental（自动检测：微信开发者工具热重载已开启）',
      'HMR 切换：关闭微信开发者工具“热重载”后重启 wv dev，或通过 weapp.hmr.runtime 显式配置。',
    ]
  }
  return [
    'HMR 模式：classic（自动检测：微信开发者工具热重载未开启或无法确认）',
    'HMR 切换：开启微信开发者工具“热重载”后重启 wv dev，或通过 weapp.hmr.runtime 显式配置。',
  ]
}
