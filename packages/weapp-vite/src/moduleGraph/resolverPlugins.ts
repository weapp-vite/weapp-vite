import type { InlineConfig, Plugin, PluginOption } from 'vite'
import { createOwnedPluginGeneration, markOwnedPlugin } from '../plugins/ownedInstances'

/** 辅助图只借用主构建的解析能力；配置、产物和资源生命周期仍由主构建持有。 */
export async function collectResolverPlugins(config: InlineConfig): Promise<Plugin[]> {
  const result: Plugin[] = []
  const copy = createOwnedPluginGeneration()
  const environment = {
    command: 'build' as const,
    mode: config.mode ?? 'production',
    isSsrBuild: Boolean(config.build?.ssr),
    isPreview: false,
  }
  const collect = async (option: PluginOption): Promise<void> => {
    const plugin = await option
    if (!plugin) {
      return
    }
    if (Array.isArray(plugin)) {
      for (const nested of plugin) {
        await collect(nested)
      }
      return
    }
    const candidate: Plugin = plugin
    if (candidate.name.startsWith('weapp-vite:') || candidate.name.startsWith('weapp-runtime:')
      || candidate.apply === 'serve'
      || (typeof candidate.apply === 'function' && !candidate.apply(config, environment))) {
      return
    }
    result.push(copy(markOwnedPlugin({
      name: candidate.name,
      enforce: candidate.enforce,
      resolveId: candidate.resolveId,
      resolveDynamicImport: candidate.resolveDynamicImport,
      load: candidate.load,
      transform: candidate.transform,
      // 辅助图需要接收真实文件保存，以便把变更交给主构建的快照调度器。
      hotUpdate: candidate.hotUpdate,
    })))
  }
  await collect(config.plugins)
  return result
}
