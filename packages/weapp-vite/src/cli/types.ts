import type { LogLevel } from '../logger'

export interface GlobalCLIOptions {
  '--'?: string[]
  'c'?: boolean | string
  'config'?: string
  'base'?: string
  'l'?: LogLevel
  'logLevel'?: LogLevel
  'clearScreen'?: boolean
  'd'?: boolean | string
  'debug'?: boolean | string
  'f'?: string
  'filter'?: string
  'm'?: string
  'mode'?: string
  'force'?: boolean
  'mcp'?: boolean
  'skipNpm'?: boolean
  'open'?: boolean
  'host'?: boolean | string
  'json'?: boolean | string
  'strict'?: boolean | string
  'output'?: string
  'p'?: string
  'platform'?: string
  'projectConfig'?: string
  'ticket'?: string
  'trustProject'?: boolean
  'ideOpenStrategy'?: 'cli' | 'automator'
  'openRecovery'?: boolean
  'loginRetry'?: string
  'loginRetryTimeout'?: string
  'nonInteractive'?: boolean
  'outDir'?: string
  'sourcemap'?: boolean | 'false' | 'hidden' | 'inline' | 'true'
  'minify'?: boolean | 'esbuild' | 'false' | 'oxc' | 'terser' | 'true'
  'emptyOutDir'?: boolean
  'analyze'?: boolean
  'ui'?: boolean
  'watch'?: boolean
  'scope'?: string
}

export interface AnalyzeCLIOptions extends GlobalCLIOptions {
  hmrProfile?: boolean | string
  budgetCheck?: boolean | string
  glassEaselCheck?: boolean | string
  preload?: boolean | string
  json?: boolean | string
  markdown?: boolean | string
  report?: string
  output?: string
}
