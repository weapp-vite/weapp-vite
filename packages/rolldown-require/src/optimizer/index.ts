export interface ExportsData {
  hasModuleSyntax: boolean
  // exported names (for `export { a as b }`, `b` is exported name)
  exports: readonly string[]
  // hint if the dep requires loading as jsx
  jsxLoader?: boolean
}

export interface OptimizedDepInfo {
  id: string
  file: string
  src?: string
  needsInterop?: boolean
  browserHash?: string
  fileHash?: string
  /**
   * 优化过程中 id 可能已解析到最终位置，
   * 但 bundle 可能尚未落盘。
   */
  processing?: Promise<void>
  /**
   * ExportsData 缓存：新发现依赖会解析源码入口以获取导出信息，
   * 用于判断是否需要 interop 以及预构建阶段使用。
   */
  exportsData?: Promise<ExportsData>
  isDynamicEntry?: boolean
}

export interface DepOptimizationMetadata {
  /**
   * 主 hash 由用户配置与依赖锁文件共同决定。
   * 在服务启动时检查，用于避免不必要的重复构建。
   */
  hash: string
  /**
   * 该 hash 由依赖锁文件决定。
   * 在服务启动时检查，用于避免不必要的重复构建。
   */
  lockfileHash: string
  /**
   * 该 hash 由用户配置决定。
   * 在服务启动时检查，用于避免不必要的重复构建。
   */
  configHash: string
  /**
   * 浏览器 hash 由主 hash 与运行时发现的额外依赖共同决定，
   * 用于让浏览器对优化依赖请求失效。
   */
  browserHash: string
  /**
   * 已优化依赖的元数据
   */
  optimized: Record<string, OptimizedDepInfo>
  /**
   * 非入口优化 chunk 与动态导入的元数据
   */
  chunks: Record<string, OptimizedDepInfo>
  /**
   * 处理后新发现依赖的元数据
   */
  discovered: Record<string, OptimizedDepInfo>
  /**
   * OptimizedDepInfo 列表
   */
  depInfoList: OptimizedDepInfo[]
}

export interface DepOptimizationConfig {
  /**
   * 强制优化指定依赖（必须是可解析的导入路径，不能是 glob）。
   */
  include?: string[]
  /**
   * 不优化这些依赖（必须是可解析的导入路径，不能是 glob）。
   */
  exclude?: string[]
  /**
   * 导入这些依赖时强制 ESM interop。
   * 一些旧包宣称为 ESM，但内部仍使用 `require`。
   * @experimental
   */
  needsInterop?: string[]
  /**
   * 依赖扫描与优化阶段传给 esbuild 的配置。
   *
   * 部分选项被省略，因为修改它们会与 Vite 的依赖优化不兼容。
   *
   * - `external` 被省略，请使用 Vite 的 `optimizeDeps.exclude`
   * - `plugins` 会与 Vite 的 dep 插件合并
   *
   * https://esbuild.github.io/api
   */
  // esbuildOptions?: DepsOptimizerEsbuildOptions
  // rollupOptions?: Omit<RolldownOptions, 'input' | 'logLevel' | 'output'> & {
  //   output?: Omit<
  //     RolldownOutputOptions,
  //     'format' | 'sourcemap' | 'dir' | 'banner'
  //   >
  // }
  /**
   * 可优化的文件扩展名列表，对应扩展名需要有匹配的 esbuild 插件。
   *
   * 默认 Vite 优化 `.mjs`、`.js`、`.ts`、`.mts` 文件。该选项可补充其他扩展名。
   *
   * @experimental
   */
  extensions?: string[]
  /**
   * Vite 5.1 已移除 build 阶段依赖优化。该选项已冗余，
   * 未来会移除。建议改用 `optimizeDeps.noDiscovery` 并将
   * `optimizeDeps.include` 设为空或不设置。
   * true 或 'dev' 表示关闭优化，false 或 'build' 表示保留。
   * @default 'build'
   * @deprecated
   * @experimental
   */
  disabled?: boolean | 'build' | 'dev'
  /**
   * 自动发现依赖。当 `noDiscovery` 为 true 时，仅优化 `include` 中的依赖。
   * 此时冷启动不会运行扫描器。开发阶段仅 CJS 的依赖需要显式写入 `include`。
   * @default false
   * @experimental
   */
  noDiscovery?: boolean
  /**
   * 启用后会在冷启动阶段等待静态导入全部被爬取后再返回首轮优化结果。
   * 这可避免新依赖触发新的 common chunk 导致整页刷新。
   * 若扫描器与 `include` 已覆盖所有依赖，建议关闭该选项以便浏览器并行更多请求。
   * @default true
   * @experimental
   */
  holdUntilCrawlEnd?: boolean
}

export type DepOptimizationOptions = DepOptimizationConfig & {
  /**
   * 默认情况下，Vite 会爬取 `index.html` 来发现需要预构建的依赖。
   * 若指定 `build.rollupOptions.input`，则改为爬取这些入口。
   *
   * 若以上方式都不满足需求，可通过该选项指定自定义入口：
   * 值为相对项目根目录的 tinyglobby 模式或数组
   * (https://github.com/SuperchupuDev/tinyglobby)，会覆盖默认入口推断。
   */
  entries?: string | string[]
  /**
   * 无论依赖是否变化都强制预优化。
   * @experimental
   */
  force?: boolean
}

export interface DepsOptimizer {
  init: () => Promise<void>

  metadata: DepOptimizationMetadata
  scanProcessing?: Promise<void>
  registerMissingImport: (id: string, resolved: string) => OptimizedDepInfo
  run: () => void

  isOptimizedDepFile: (id: string) => boolean
  isOptimizedDepUrl: (url: string) => boolean
  getOptimizedDepId: (depInfo: OptimizedDepInfo) => string

  close: () => Promise<void>

  options: DepOptimizationOptions
}
