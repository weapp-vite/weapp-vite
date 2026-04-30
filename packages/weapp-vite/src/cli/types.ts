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
  'skipNpm'?: boolean
  'open'?: boolean
  'host'?: boolean | string
  'json'?: boolean | string
  'output'?: string
  'p'?: string
  'platform'?: string
  'projectConfig'?: string
  'ticket'?: string
  'trustProject'?: boolean
  'analyze'?: boolean
  'ui'?: boolean
}

export interface AnalyzeCLIOptions extends GlobalCLIOptions {
  hmrProfile?: boolean | string
  budgetCheck?: boolean | string
  json?: boolean | string
  markdown?: boolean | string
  report?: string
  output?: string
}
