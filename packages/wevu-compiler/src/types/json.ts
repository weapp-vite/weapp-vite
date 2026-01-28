export type JsonMergeStage
  = | 'defaults'
    | 'json-block'
    | 'auto-using-components'
    | 'component-generics'
    | 'macro'
    | 'emit'
    | 'merge-existing'

export interface JsonMergeContext {
  filename?: string
  kind?: 'app' | 'page' | 'component' | 'unknown'
  stage: JsonMergeStage
}

export type JsonMergeFunction = (
  target: Record<string, any>,
  source: Record<string, any>,
  context: JsonMergeContext,
) => Record<string, any> | void

export type JsonMergeStrategy = 'deep' | 'assign' | 'replace' | JsonMergeFunction

export interface JsonConfig {
  /**
   * 产物 JSON 默认值（用于 app/page/component）
   */
  defaults?: {
    app?: Record<string, any>
    page?: Record<string, any>
    component?: Record<string, any>
  }
  /**
   * JSON 合并策略
   * - `deep`: 深合并（默认）
   * - `assign`: 浅合并（Object.assign）
   * - `replace`: 直接替换
   * - `function`: 自定义合并函数
   */
  mergeStrategy?: JsonMergeStrategy
}
