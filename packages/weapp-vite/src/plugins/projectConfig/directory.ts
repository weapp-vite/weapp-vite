import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { resolveProjectConfigSyncDirs } from '../../utils/projectConfig'
import { collectProjectConfigAssets, publishProjectConfigAssets } from '../../utils/projectConfigOutput'

/** 三入口共同管理目录式平台配置；与主编译共享每轮写出和关闭等待。 */
export function createProjectConfigDirectoryPlugin(ctx: CompilerContext): Plugin {
  const service = ctx.configService
  const dirs = service.multiPlatform.enabled && service.projectConfigPath && !service.pluginOnly && !service.weappLibConfig?.enabled
    ? resolveProjectConfigSyncDirs({ outDir: service.outDir, projectConfigPath: service.projectConfigPath })
    : undefined
  let owned = new Set<string>()
  return {
    name: 'weapp-vite:project-config-directory',
    config(config) {
      if (dirs?.shouldSync && !service.isDev && config.build?.write === false) {
        throw new Error('[weapp-vite] 目录式平台配置暂不支持 build.write=false，请使用 multiPlatform.projectConfigs 内联配置。')
      }
    },
    async buildStart() {
      if (dirs?.shouldSync) {
        await collectProjectConfigAssets(dirs.sourceDir, dirs.outputRoot, service.outDir, file => this.addWatchFile(file))
      }
    },
    writeBundle: {
      sequential: true,
      async handler(_options, bundle) {
        if (!dirs?.shouldSync || !Object.hasOwn(bundle, 'app.json')) {
          return
        }
        const assets = await collectProjectConfigAssets(dirs.sourceDir, dirs.outputRoot, service.outDir, file => this.addWatchFile(file))
        owned = await publishProjectConfigAssets(dirs.outputRoot, assets, owned)
      },
    },
  }
}
