import type { Plugin } from 'vite'
import type { MutableCompilerContext } from '../../context'
import { recordHmrProfileDuration } from '../../utils/hmrProfile'

/**
 * @description 在 generateBundle 与 writeBundle 之间测量开发态写盘尾段。
 */
export function createHmrProfileMetricsPlugin(ctx: MutableCompilerContext): Plugin {
  let writeStartAt: number | undefined

  return {
    name: 'weapp-vite:hmr-profile-metrics',

    generateBundle(_options, _bundle, isWrite) {
      if (!ctx.configService?.isDev || !isWrite) {
        return
      }
      writeStartAt = performance.now()
    },

    writeBundle() {
      if (!ctx.configService?.isDev || writeStartAt === undefined) {
        return
      }
      recordHmrProfileDuration(ctx.runtimeState?.build?.hmr?.profile, 'writeMs', performance.now() - writeStartAt)
      writeStartAt = undefined
    },

    buildEnd() {
      writeStartAt = undefined
    },

    closeBundle() {
      writeStartAt = undefined
    },
  }
}
