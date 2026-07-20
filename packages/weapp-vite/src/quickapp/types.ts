export interface QuickAppToolkitConfig {
  /**
   * 是否在 Vite 工程输出后调用 hap-toolkit 生成 RPK。
   */
  enabled?: boolean
  /**
   * 是否启用 hap-toolkit 官方 E2E 测试注入。
   */
  e2e?: boolean
  /**
   * 传递给 hap build 的 source map 配置，设置为 false 可关闭。
   */
  devtool?: string | false
  /**
   * 追加传递给 hap build 的参数。
   */
  args?: string[]
}

export interface QuickAppConfig {
  /**
   * QuickApp 源码目录，必须包含 manifest.json 和原生 app.ux。
   */
  srcDir?: string
  /**
   * QuickApp 工程输出目录。
   */
  outDir?: string
  /**
   * hap-toolkit E2E 测试目录。设置为 false 可禁用复制。
   */
  testDir?: string | false
  /**
   * 官方 hap-toolkit 构建配置。
   */
  toolkit?: QuickAppToolkitConfig
}

export interface ResolvedQuickAppConfig {
  cwd: string
  srcDir: string
  outDir: string
  testDir?: string
  toolkit: Required<Omit<QuickAppToolkitConfig, 'devtool'>> & {
    devtool: string | false
  }
}

export interface QuickAppBuildOptions {
  cwd: string
  configFile?: string
  mode?: string
  e2e?: boolean
  watch?: boolean
}

export interface QuickAppBuildResult {
  config: ResolvedQuickAppConfig
  rpkFiles: string[]
}

export interface QuickAppDevSession {
  config: ResolvedQuickAppConfig
  close: () => Promise<void>
  waitForExit: () => Promise<void>
}
