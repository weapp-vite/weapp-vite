import type { Plugin } from 'vite'
import type { CompilerContext } from '../../context'
import { Buffer } from 'node:buffer'
import path from 'pathe'
import { resolveIdePrivateConfigPath } from '../../runtime/classicIdeConfig'
import { getHmrRuntimeSession } from '../../runtime/hmrRuntimeSession'
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
        const privateConfigPath = service.isDev && service.platform === 'weapp' ? resolveIdePrivateConfigPath(service) : undefined
        if (privateConfigPath && getHmrRuntimeSession(ctx).classicIdeConfig.hasPendingAssetHandoff(privateConfigPath)) {
          return
        }
        const assets = await collectProjectConfigAssets(dirs.sourceDir, dirs.outputRoot, service.outDir, file => this.addWatchFile(file))
        const privateConfig = assets.find(asset => path.resolve(dirs.outputRoot, asset.fileName) === privateConfigPath)
        let commitPrivateConfig: (() => Promise<void>) | undefined
        if (privateConfigPath && privateConfig) {
          const source = typeof privateConfig.source === 'string' ? privateConfig.source : Buffer.from(privateConfig.source).toString('utf8')
          const publication = await getHmrRuntimeSession(ctx).classicIdeConfig.preparePublication(privateConfigPath, source)
          // 未完成完整主应用交接的批次不能覆盖或裁剪仍由资产租约持有的项目配置。
          if (publication.deferred) {
            return
          }
          privateConfig.source = publication.source
          commitPrivateConfig = publication.commit
        }
        const published = await publishProjectConfigAssets(dirs.outputRoot, assets, owned)
        await commitPrivateConfig?.()
        owned = published
      },
    },
  }
}
