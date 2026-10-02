import type { Plugin } from 'vite'
import type { CompilerContext } from '../context'
import { prepareLibDtsAssets } from '../runtime/libDts/assets'
import { addNormalizedWatchFile } from './utils/watchFiles'

/** 声明文件纳入原生发布事务，三个入口与生产 watch 共享同一生成阶段。 */
export function createLibDtsPlugin(ctx: CompilerContext): Plugin {
  return {
    name: 'weapp-vite:lib-dts',
    enforce: 'post',
    buildStart() {
      // 声明图包含被擦除的 type-only 依赖，原生 bundle 不会把它们纳入模块监听。
      // 提前登记 lib 根目录，避免生产 watch 在首次构建完成前错过 FSEvents 注册窗口。
      const libConfig = ctx.configService.weappLibConfig
      if (this.meta.watchMode && libConfig?.dts?.enabled !== false) {
        const root = libConfig.root
        if (root) {
          addNormalizedWatchFile(this, root)
        }
      }
    },
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
