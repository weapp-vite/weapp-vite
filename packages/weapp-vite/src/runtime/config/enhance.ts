import type { EnhanceOptions, WeappViteConfig } from '../../types'
import logger from '../../logger'

const enhanceKeys: (keyof EnhanceOptions)[] = ['wxml', 'wxs', 'autoImportComponents']

let hasLoggedEnhanceDeprecation = false

export function hasDeprecatedEnhanceUsage(enhance?: EnhanceOptions) {
  if (!enhance || typeof enhance !== 'object') {
    return false
  }
  return enhanceKeys.some(key => Object.prototype.hasOwnProperty.call(enhance, key))
}

export interface MigrateEnhanceOptionsConfig {
  wxml?: boolean
  wxs?: boolean
  autoImportComponents?: boolean
}

export function migrateEnhanceOptions(
  target: WeappViteConfig | undefined,
  options: {
    warn: boolean
    userConfigured?: MigrateEnhanceOptionsConfig
  },
) {
  if (!target) {
    return
  }

  const enhance = target.enhance
  const userConfigured = options.userConfigured ?? {}

  if (!userConfigured.wxml && enhance?.wxml !== undefined) {
    target.wxml = enhance.wxml
  }

  if (!userConfigured.wxs && enhance?.wxs !== undefined) {
    target.wxs = enhance.wxs
  }

  if (!userConfigured.autoImportComponents && enhance?.autoImportComponents !== undefined) {
    target.autoImportComponents = enhance.autoImportComponents
  }

  if (options.warn && !hasLoggedEnhanceDeprecation) {
    hasLoggedEnhanceDeprecation = true
    logger.warn('`weapp.enhance` 已废弃，将在 weapp-vite@6 移除，请改用顶层的 `weapp.wxml`、`weapp.wxs` 与 `weapp.autoImportComponents`。')
  }
}
