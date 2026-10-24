import type { MpPlatform } from '../types'
import type { HmrRuntime } from './hmrRuntime'
import type { HmrRuntimeFallbackReason } from './hmrRuntimeCapabilities'

/** 当前微信宿主尚未证明完整重载交接能力，必须在安装 stateful 资源前选择 classic。 */
export function resolveStatefulHmrStartupFallback(options: {
  platform: MpPlatform
  runtime: HmrRuntime
}): HmrRuntimeFallbackReason | undefined {
  if (options.platform === 'weapp' && options.runtime === 'stateful-experimental') {
    return {
      code: 'ide-classic-handoff',
      message: '当前微信开发者工具缺少可确认的 classic 完整重载交接能力，启动时使用 classic HMR。',
    }
  }
}
