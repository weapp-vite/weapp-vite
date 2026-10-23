import { access } from 'node:fs/promises'
import path from 'node:path'
import { createSiblingPluginConfig } from '../../packages/weapp-vite/scripts/consumerHmr/configWrapper.mjs'
import { DEFAULT_VITE_CONFIG_FILES } from '../../packages/weapp-vite/src/utils/loadViteConfigFile'
import { resolveWeappConfigFile } from '../../packages/weapp-vite/src/utils/weappConfig'

/** 复用默认配置发现与合并顺序，只给原配置增加既有的原生发布观察插件。 */
export async function createWorkspaceNativePublicationConfig(project: {
  root: string
  sourceRoot: string
  distRoot: string
}, profilePath: string) {
  let viteConfig: string | undefined
  for (const name of DEFAULT_VITE_CONFIG_FILES) {
    const file = path.join(project.root, name)
    try {
      await access(file)
      viteConfig = file
      break
    }
    catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        throw error
      }
    }
  }
  const weappConfig = await resolveWeappConfigFile({ root: project.root })
  const configFiles = [...new Set([viteConfig, weappConfig].filter((file): file is string => Boolean(file)))]
  return createSiblingPluginConfig({
    directory: path.dirname(configFiles.at(-1) ?? path.join(project.root, 'vite.config.mjs')),
    configFiles,
    pluginUrl: new URL('../../e2e/utils/nativePublication/plugin.ts', import.meta.url).href,
    pluginExport: 'nativePublicationPlugin',
    pluginOptions: {
      sourceRoot: path.relative(project.root, project.sourceRoot) || '.',
      outputRoot: path.relative(project.root, project.distRoot),
      profilePath,
    },
    mergeUrl: import.meta.resolve('@weapp-core/shared'),
  })
}
