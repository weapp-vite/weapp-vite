import type { NavigationBarConfig } from '../compiler/wxml'

export function pickNavigationConfig(source: Record<string, unknown> | undefined): NavigationBarConfig {
  const config: NavigationBarConfig = {}
  if (!source) {
    return config
  }
  if (typeof source.navigationBarTitleText === 'string') {
    config.title = source.navigationBarTitleText
  }
  if (typeof source.navigationBarBackgroundColor === 'string') {
    config.backgroundColor = source.navigationBarBackgroundColor
  }
  if (typeof source.navigationBarTextStyle === 'string') {
    config.textStyle = source.navigationBarTextStyle
  }
  if (typeof source.navigationStyle === 'string') {
    config.navigationStyle = source.navigationStyle
  }
  return config
}

export function mergeNavigationConfig(base: NavigationBarConfig, overrides: NavigationBarConfig) {
  return {
    ...base,
    ...overrides,
  }
}
