import type { MpPlatform } from '../types'

export type HmrRuntime = 'classic' | 'stateful-experimental'
export type HmrRuntimeSetting = 'auto' | HmrRuntime | undefined

interface HmrRuntimeStartupMessageOptions {
  platform: MpPlatform
  configured?: HmrRuntimeSetting
  compileHotReLoad?: unknown
  runtime: HmrRuntime
}

export function resolveHmrRuntime(options: {
  platform: MpPlatform
  configured?: HmrRuntimeSetting
  compileHotReLoad?: unknown
}): HmrRuntime {
  if (options.configured === 'classic' || options.configured === 'stateful-experimental') {
    return options.configured
  }
  if (options.platform === 'weapp' && options.compileHotReLoad === true) {
    return 'stateful-experimental'
  }
  return 'classic'
}

export function formatHmrRuntimeStartupMessages(options: HmrRuntimeStartupMessageOptions): [string, string] {
  const isExplicit = options.configured === 'classic' || options.configured === 'stateful-experimental'
  if (isExplicit) {
    const alternative = options.runtime === 'classic' ? 'stateful-experimental' : 'classic'
    return [
      `HMR 模式：${options.runtime}（显式配置）`,
      `HMR 切换：修改 weapp.hmr.runtime 为 auto 或 ${alternative} 后重启 wv dev。`,
    ]
  }
  if (options.platform !== 'weapp') {
    return [
      'HMR 模式：classic（自动检测：仅微信小程序支持 stateful-experimental）',
      'HMR 切换：可通过 weapp.hmr.runtime 显式配置 classic。',
    ]
  }
  if (options.compileHotReLoad === true) {
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
