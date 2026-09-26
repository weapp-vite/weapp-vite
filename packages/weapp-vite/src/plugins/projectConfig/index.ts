import type { Plugin } from 'vite'
import type { MpPlatform } from '../../types'
import { getProjectPlatformOptions } from '../../platform'
import { resolveWeappViteHostMeta } from '../../pluginHost'

/** 将已规范化的平台项目配置交给主应用的原生构建产物管理。 */
export function createProjectConfigPlugin(platform: MpPlatform, projectConfig: Record<string, unknown>): Plugin {
  const { projectConfigFileName } = getProjectPlatformOptions(platform)
  const source = JSON.stringify(projectConfig, null, 2)
  return {
    name: 'weapp-vite:project-config',
    apply: config => resolveWeappViteHostMeta(config)?.runtime === 'miniprogram',
    generateBundle: {
      order: 'post',
      handler(_output, bundle) {
        if (Object.hasOwn(bundle, 'app.json')) {
          const existing = bundle[projectConfigFileName]
          if (existing?.type === 'asset') {
            existing.source = source
          }
          else {
            this.emitFile({ type: 'asset', fileName: projectConfigFileName, source })
          }
        }
      },
    },
  }
}
