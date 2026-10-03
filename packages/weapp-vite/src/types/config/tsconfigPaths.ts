import type { PluginOptions } from 'vite-tsconfig-paths'

/** 高级路径适配选项，保留旧配置的类型兼容。 */
export interface TsconfigPathsOptions extends PluginOptions {
  /** @deprecated 解析器已统一处理继承和路径，此选项仅兼容旧配置，不再加载 TypeScript 编译器。 */
  parseNative?: boolean
}
