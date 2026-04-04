export interface ResolvedValue { name: string, from: string }

export type ResolverSupportFilesStrategy = 'used' | 'full'

export interface ExternalMetadataFileCandidates {
  packageName: string
  /**
   * 相对包根目录的路径。
   */
  dts: string[]
  /**
   * 相对包根目录的路径。
   */
  js: string[]
}

export interface ResolverMeta {
  /**
   * 解析器静态可用的组件映射
   */
  components?: Record<string, string>
  /**
   * `.weapp-vite` 支持文件生成策略。
   * - `used`: 仅为模板/源码实际命中的组件生成支持文件
   * - `full`: 为 resolver 静态可枚举的全部组件生成支持文件
   */
  supportFilesStrategy?: ResolverSupportFilesStrategy
  /**
   * 当 `from` 命中该解析器管理的外部依赖时，返回该依赖在包内可能的 metadata 文件候选路径。
   *
   * 用于 `autoImportComponents` 生成类型/补全时，从第三方组件库读取 props 类型信息。
   */
  resolveExternalMetadataCandidates?: (from: string) => ExternalMetadataFileCandidates | undefined
}

export type ResolverFn = ((componentName: string, baseName: string) => ResolvedValue | void) & ResolverMeta

export interface ResolverObject extends ResolverMeta {
  resolve?: (componentName: string, baseName: string) => ResolvedValue | void
}

export type Resolver = ResolverFn | ResolverObject

interface ResolveOptions {
  name: string
  prefix: string
}

export interface Options {
  prefix?: string
  supportFilesStrategy?: ResolverSupportFilesStrategy
  resolve?: (options: ResolveOptions) => { key: string, value: string }
}

export type CreateResolver = (options?: Options) => Resolver
