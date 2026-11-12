import type { InlineConfig } from 'vite'
import type { NativePublicationOptions } from '../../e2e/utils/nativePublication/files'
import type { WeappVitePluginApi } from '../../packages/weapp-vite/src/types/plugin'
import path from 'node:path'
import process from 'node:process'
import { nativePublicationPlugin } from '../../e2e/utils/nativePublication/plugin'
import { resolveWorkspaceHmrProjectTarget, WORKSPACE_HMR_TARGET_PREFIX } from './projectTarget'

const targetsKey = Symbol.for('weapp-vite.workspace-hmr-project-targets')
interface ProjectTarget {
  platform: string
  distRoot: string
}

/** 配置重启会重新求值插件；回执所有权属于本次受管进程，而非单个配置实例。 */
function projectTargets() {
  const owner = process as typeof process & { [targetsKey]?: Map<string, ProjectTarget> }
  return owner[targetsKey] ??= new Map()
}

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
  return {
    ...config,
    weapp: { ...config.weapp, platform },
    plugins: [
      {
        name: 'workspace-hmr:project-target',
        // 快照编译同样拥有正式配置身份；是否写出由独立的原生发布观察器确认。
        apply: (_candidate, { command }) => command === 'build',
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
          publicationOptions.outputRoot = distRoot
          const targets = projectTargets()
          const published = targets.get(options.id)
          if (published) {
            if (published.distRoot !== distRoot || published.platform !== platform) {
              throw new Error('Workspace HMR project output root or platform changed during acceptance.')
            }
            return
          }
          targets.set(options.id, { platform, distRoot })
          process.stdout.write(`${WORKSPACE_HMR_TARGET_PREFIX}${JSON.stringify({ id: options.id, pid: process.pid, platform, distRoot })}\n`)
        },
      },
      nativePublicationPlugin(publicationOptions),
      ...(config.plugins ?? []),
    ],
  }
}
