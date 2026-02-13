import type { NavigationBarConfig } from '../compiler/wxml'
import type { WxssTransformOptions } from '../css/wxss'

export interface WeappWebPluginOptions {
  wxss?: WxssTransformOptions
  /**
   * 小程序项目的源代码根目录，默认 `<root>/src`。
   */
  srcDir?: string
  /**
   * Web 运行时的表单行为配置。
   */
  form?: {
    /**
     * 为 true 时阻止浏览器默认的表单提交，默认 true。
     */
    preventDefault?: boolean
  }
  /**
   * Web 运行时执行策略。
   */
  runtime?: {
    /**
     * 表达式与 WXS 执行模式：
     * - compat: 保持当前行为（默认）
     * - safe: 忽略解析/执行异常并告警
     * - strict: 解析/执行异常直接抛错
     */
    executionMode?: 'compat' | 'safe' | 'strict'
    /**
     * 运行时告警策略：
     * - warn: 使用 console.warn 输出（默认）
     * - error: 使用 console.error 输出
     * - off: 关闭告警输出
     *
     * dedupe 为 true 时同 key 告警仅输出一次（默认）。
     */
    warnings?: {
      level?: 'off' | 'warn' | 'error'
      dedupe?: boolean
    }
  }
}

export interface ModuleMeta {
  kind: 'app' | 'page' | 'component'
  id: string
  scriptPath: string
  templatePath?: string
  stylePath?: string
}

export interface PageEntry {
  script: string
  id: string
}

export interface ComponentEntry {
  script: string
  id: string
}

export interface ScanResult {
  app?: string
  pages: PageEntry[]
  components: ComponentEntry[]
}

export interface ScanState {
  moduleMeta: Map<string, ModuleMeta>
  pageNavigationMap: Map<string, NavigationBarConfig>
  templateComponentMap: Map<string, Record<string, string>>
  templatePathSet: Set<string>
  componentTagMap: Map<string, string>
  componentIdMap: Map<string, string>
  appNavigationDefaults: NavigationBarConfig
  appComponentTags: Record<string, string>
  scanResult: ScanResult
}

export type WarnFn = (message: string) => void
