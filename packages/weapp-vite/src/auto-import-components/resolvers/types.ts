export interface ResolvedValue { name: string, from: string }

export interface Resolver {
  (componentName: string, baseName: string): ResolvedValue | void
  /**
   * 解析器静态可用的组件映射
   */
  components?: Record<string, string>
}

interface ResolveOptions {
  name: string
  prefix: string
}

export interface Options {
  prefix?: string
  resolve?: (options: ResolveOptions) => { key: string, value: string }
}

export type CreateResolver = (options?: Options) => Resolver
