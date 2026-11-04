import type { InlineConfig } from 'vite'
import type { NativePublicationOptions } from '../../e2e/utils/nativePublication/files'
import type { WeappVitePluginApi } from '../../packages/weapp-vite/src/types/plugin'
import path from 'node:path'
import process from 'node:process'
import { nativePublicationPlugin } from '../../e2e/utils/nativePublication/plugin'
import { resolveWorkspaceHmrProjectTarget, WORKSPACE_HMR_TARGET_PREFIX } from './projectTarget'

/** 配置与插件资源完全属于实际开发进程；最终输出目录由 Vite 正式配置回报。 */
export function createWorkspaceHmrProjectConfig(config: InlineConfig, options: {
  id: string
  sourceRoot: string
  profilePath: string
}): InlineConfig {
  const platform = resolveWorkspaceHmrProjectTarget(config)
  const publicationOptions: NativePublicationOptions = {
    sourceRoot: options.sourceRoot,
    profilePath: options.profilePath,
  }
  let publishedRoot: string | undefined
  return {
    ...config,
    weapp: { ...config.weapp, platform },
    plugins: [
      {
        name: 'workspace-hmr:project-target',
        apply: (candidate, { command }) => command === 'build' && candidate.build?.write !== false,
        configResolved(resolved) {
          if (resolved.plugins.some(plugin => plugin.name === 'weapp-vite:workers')) {
            return
          }
          const context = resolved.plugins.find(plugin => plugin.name === 'weapp-vite:context')?.api as WeappVitePluginApi | undefined
          // 插件子构建继承同一观察器，但拥有独立输出根，不能冒充主应用的路径漂移。
          if (context?.ctx.configService.pluginOnly || context?.ctx.currentBuildTarget === 'plugin') {
            return
          }
          const distRoot = path.resolve(resolved.root, resolved.build.outDir)
          if (publishedRoot) {
            if (publishedRoot !== distRoot) {
              throw new Error('Workspace HMR project output root changed during acceptance.')
            }
            return
          }
          publishedRoot = distRoot
          publicationOptions.outputRoot = distRoot
          process.stdout.write(`${WORKSPACE_HMR_TARGET_PREFIX}${JSON.stringify({ id: options.id, pid: process.pid, platform, distRoot })}\n`)
        },
      },
      nativePublicationPlugin(publicationOptions),
      ...(config.plugins ?? []),
    ],
  }
}
