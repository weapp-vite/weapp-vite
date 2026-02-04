import type { ExternalOption, InputOptions, OutputOptions } from 'rolldown'

export type RequireFunction = (
  outfile: string,
  ctx: { format: 'cjs' | 'esm' },
) => any

export interface CacheEvent {
  type: 'hit' | 'miss' | 'store' | 'skip-invalid'
  key: string
  reason?: string
}

export interface CacheOptions {
  /**
   * 启用持久化缓存，可传入对象进行配置。
   */
  enabled?: boolean
  /**
   * 可选缓存目录。默认使用最近的 `node_modules/.rolldown-require-cache`
   * 或 `os.tmpdir()/rolldown-require-cache`。
   */
  dir?: string
  /**
   * 写入新缓存前清理已有条目。
   */
  reset?: boolean
  /**
   * 同时保留进程内缓存以减少文件系统访问。
   * 启用持久化缓存时默认 true。
   */
  memory?: boolean
  /**
   * 接收缓存事件，用于调试或指标统计。
   */
  onEvent?: (event: CacheEvent) => void
}

export type GetOutputFile = (filepath: string, format: 'esm' | 'cjs') => string
// RolldownOutput, RollupError
// export type RebuildCallback = (
//   error: RollupError | null,
//   result: RolldownOutput | null,
// ) => void

export type ReadFile = (filepath: string) => string

export interface Options {
  cwd?: string
  /**
   * 需要打包并 require 的文件路径。
   */
  filepath: string
  /**
   * 用于加载输出文件的 `require` 方法。
   * 默认为全局 `require`。
   * 可为异步函数（返回 Promise）。
   */
  require?: RequireFunction
  /**
   * Rolldown 构建选项。
   */
  rolldownOptions?: {
    input?: InputOptions
    output?: OutputOptions
  }

  /**
   * 获取输出文件路径。
   * 默认仅替换扩展名为 `.bundled_{randomId}.js`。
   */
  getOutputFile?: GetOutputFile
  /**
   * 启用监听并在每次重建后触发回调。
   */
  // onRebuild?: (ctx: {
  //   err?: RollupError
  //   mod?: any
  //   dependencies?: string[]
  // }) => void

  /** 外部依赖（external） */
  external?: ExternalOption

  /** 非 external 的依赖 */
  // notExternal?: (string | RegExp)[]

  /**
   * 自动将 node_modules 标记为 external。
   * @default true - 当 `filepath` 位于 node_modules 时为 false
   */
  // externalNodeModules?: boolean

  /**
   * 自定义 tsconfig 路径，用于读取 `paths` 配置。
   *
   * 设为 `false` 以禁用 tsconfig。
   */
  tsconfig?: string | false

  /**
   * 保留编译后的临时文件便于调试。
   * 默认为 `process.env.BUNDLE_REQUIRE_PRESERVE`。
   */
  preserveTemporaryFile?: boolean

  /**
   * 显式指定 bundle 格式，跳过默认推断。
   */
  format?: 'cjs' | 'esm'

  /**
   * 启用 source map 便于调试。
   * - `true` 默认使用内联 source map。
   * - `'inline'` 强制内联 source map。
   */
  sourcemap?: boolean | 'inline'

  /**
   * 持久化缓存打包结果，加速重复加载。
   */
  cache?: boolean | CacheOptions

  // readFile?: ReadFile
}

export interface InternalOptions extends Omit<Options, 'cwd' | 'filepath'> {
  isESM: boolean
  format: 'cjs' | 'esm'
  tsconfig?: string | false
  sourcemap?: boolean | 'inline'
}
