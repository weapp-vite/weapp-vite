/**
 * @description 基础配置
 */
export interface BaseConfig {
  cliPath: string
}

/**
 * @description 配置来源
 */
export type ConfigSource = 'custom' | 'default' | 'missing'

/**
 * @description 解析后的配置
 */
export interface ResolvedConfig extends BaseConfig {
  source: ConfigSource
}

/**
 * @description CLI 参数别名配置
 */
export interface AliasEntry {
  find: string
  replacement: string
}
