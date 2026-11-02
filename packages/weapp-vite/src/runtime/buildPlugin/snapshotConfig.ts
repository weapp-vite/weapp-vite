import type { EnvironmentOptions, InlineConfig } from 'vite'
import { createOwnedPluginGeneration } from '../../plugins/ownedInstances'

type PluginGeneration = ReturnType<typeof createOwnedPluginGeneration>

function copyBuildOptions<T extends NonNullable<EnvironmentOptions['build']>>(options: T, generation: PluginGeneration): T {
  const rolldown = options.rolldownOptions
  const plugins = generation(rolldown?.plugins)
  const copyOutput = <T>(output: T): T => {
    if (!output || typeof output !== 'object') {
      return output
    }
    if (Array.isArray(output)) {
      const copies = output.map(copyOutput)
      return (copies.every((copy, index) => copy === output[index]) ? output : copies) as T
    }
    if (!('plugins' in output)) {
      return output
    }
    const plugins = generation(output.plugins)
    return plugins === output.plugins ? output : { ...output, plugins }
  }
  const output = copyOutput(rolldown?.output)
  return {
    ...options,
    ...(rolldown && (plugins !== rolldown.plugins || output !== rolldown.output) && {
      rolldownOptions: { ...rolldown, plugins, output },
    }),
  }
}

function copyEnvironmentOptions<T extends EnvironmentOptions>(options: T, generation: PluginGeneration): T {
  return {
    ...options,
    ...(options.resolve && { resolve: { ...options.resolve } }),
    ...(options.dev && { dev: { ...options.dev } }),
    ...(options.build && { build: copyBuildOptions(options.build, generation) }),
    ...(options.optimizeDeps && { optimizeDeps: { ...options.optimizeDeps } }),
  }
}

/** 每轮快照独占配置与自有 hook 容器，第三方插件、解析器和命名函数保留原身份。 */
export function createSnapshotBuildConfig(options: InlineConfig): InlineConfig {
  const generation = createOwnedPluginGeneration()
  return {
    ...copyEnvironmentOptions(options, generation),
    ...(options.plugins && { plugins: generation(options.plugins) }),
    // Vite 将继承顶层默认值后的环境配置写回此映射；复用会逐轮追加 alias、分包规则等数组。
    ...(options.environments && {
      environments: Object.fromEntries(Object.entries(options.environments).map(([name, environment]) => [
        name,
        copyEnvironmentOptions(environment, generation),
      ])),
    }),
    ...(options.worker && { worker: { ...options.worker } }),
    ...(options.ssr && {
      ssr: {
        ...options.ssr,
        ...(options.ssr.optimizeDeps && { optimizeDeps: { ...options.ssr.optimizeDeps } }),
      },
    }),
  }
}
