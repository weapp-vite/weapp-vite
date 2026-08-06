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
      `HMR 模式：${options.runtime}（weapp.hmr.runtime 显式配置）`,
      `切换模式：将 weapp.hmr.runtime 改为 auto 或 ${alternative}，并重启 wv dev。`,
    ]
  }
  if (options.platform !== 'weapp') {
    return [
      'HMR 模式：classic（auto：stateful-experimental 仅支持微信小程序）',
      '切换模式：可通过 weapp.hmr.runtime 显式锁定 classic；stateful-experimental 仅支持微信小程序。',
    ]
  }
  if (options.compileHotReLoad === true) {
    return [
      'HMR 模式：stateful-experimental（auto：微信开发者工具热重载已开启）',
      '切换模式：在微信开发者工具中关闭“热重载”并重启 wv dev，可切换为 classic；也可通过 weapp.hmr.runtime 显式锁定模式。',
    ]
  }
  return [
    'HMR 模式：classic（auto：微信开发者工具热重载未开启或无法确认）',
    '切换模式：在微信开发者工具中开启“热重载”并重启 wv dev，可切换为 stateful-experimental；也可通过 weapp.hmr.runtime 显式锁定模式。',
  ]
}
