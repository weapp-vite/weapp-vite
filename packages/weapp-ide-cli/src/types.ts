export interface BaseConfig {
  cliPath: string
}

export type ConfigSource = 'custom' | 'default' | 'missing'

export interface ResolvedConfig extends BaseConfig {
  source: ConfigSource
}

export interface AliasEntry {
  find: string
  replacement: string
}
