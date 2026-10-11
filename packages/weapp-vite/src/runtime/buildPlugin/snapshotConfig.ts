import type { EnvironmentOptions, InlineConfig } from 'vite'

function copyEnvironmentOptions<T extends EnvironmentOptions>(options: T): T {
  return {
    ...options,
    ...(options.resolve && { resolve: { ...options.resolve } }),
    ...(options.dev && { dev: { ...options.dev } }),
    ...(options.build && { build: { ...options.build } }),
    ...(options.optimizeDeps && { optimizeDeps: { ...options.optimizeDeps } }),
  }
}

/** 每轮快照独占 Vite 会写回的配置容器，插件、解析器和命名函数保留原身份。 */
export function createSnapshotBuildConfig(options: InlineConfig): InlineConfig {
  return {
    ...copyEnvironmentOptions(options),
    // Vite 将继承顶层默认值后的环境配置写回此映射；复用会逐轮追加 alias、分包规则等数组。
    ...(options.environments && {
      environments: Object.fromEntries(Object.entries(options.environments).map(([name, environment]) => [
        name,
        copyEnvironmentOptions(environment),
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
