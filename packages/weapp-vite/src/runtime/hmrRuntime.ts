import type { MpPlatform } from '../types'

export type HmrRuntime = 'classic' | 'stateful-experimental'
export type HmrRuntimeSetting = 'auto' | HmrRuntime | undefined

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
