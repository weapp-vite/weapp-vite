import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { prepareLibDtsAssets } from '../runtime/libDts/assets'

/** 声明文件纳入原生发布事务，三个入口与生产 watch 共享同一生成阶段。 */
export function createLibDtsPlugin(ctx: CompilerContext): Plugin {
  return {
    name: 'weapp-vite:lib-dts',
    enforce: 'post',
    generateBundle: {
      order: 'post',
      async handler() {
        if (ctx.configService.isDev || ctx.configService.weappLibConfig?.dts?.enabled === false) {
          return
        }
        for (const asset of await prepareLibDtsAssets(ctx.configService, file => this.addWatchFile(file))) {
          this.emitFile(asset)
        }
      },
    },
  }
}
