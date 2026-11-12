import type { MpPlatform } from '../types'
import type { HmrRuntime } from './hmrRuntime'
import type { HmrRuntimeFallbackReason } from './hmrRuntimeCapabilities'

/** 共享启动边界只限制平台；微信的模板、样式及注册变化由实际输入输出判定。 */
export function resolveStatefulHmrStartupFallback(options: {
  platform: MpPlatform
  runtime: HmrRuntime
}): HmrRuntimeFallbackReason | undefined {
  if (options.platform !== 'weapp' && options.runtime === 'stateful-experimental') {
    return {
      code: 'platform',
      message: '当前小程序平台不支持状态保持 HMR，使用 classic 完整发布。',
    }
  }
}
