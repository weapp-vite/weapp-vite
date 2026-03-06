import type { WevuDefaults } from 'wevu'
import type { WeappViteConfig } from '../../../types'

export type WevuPresetName = 'performance'

const PERFORMANCE_PRESET_DEFAULTS: WevuDefaults = {
  app: {
    setData: {
      strategy: 'patch',
      suspendWhenHidden: true,
      diagnostics: 'fallback',
      highFrequencyWarning: {
        enabled: true,
        devOnly: true,
      },
    },
  },
  component: {
    setData: {
      strategy: 'patch',
      suspendWhenHidden: true,
      diagnostics: 'fallback',
      highFrequencyWarning: {
        enabled: true,
        devOnly: true,
      },
    },
  },
}

function getPlainRecord(value: unknown): Record<string, any> | undefined {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return undefined
  }
  return value as Record<string, any>
}

function mergeDefaults<T extends Record<string, any>>(
  defaults?: Partial<T>,
  options?: Partial<T>,
) {
  if (!defaults) {
    return options
  }
  if (!options) {
    return defaults
  }

  const merged = {
    ...(defaults as Record<string, any>),
    ...(options as Record<string, any>),
  }

  const defaultSetData = getPlainRecord((defaults as any).setData)
  const optionSetData = getPlainRecord((options as any).setData)
  if (defaultSetData || optionSetData) {
    merged.setData = {
      ...(defaultSetData ?? {}),
      ...(optionSetData ?? {}),
    }
  }

  const defaultOptions = getPlainRecord((defaults as any).options)
  const optionOptions = getPlainRecord((options as any).options)
  if (defaultOptions || optionOptions) {
    merged.options = {
      ...(defaultOptions ?? {}),
      ...(optionOptions ?? {}),
    }
  }

  return merged as Partial<T>
}

function mergeWevuDefaults(base: WevuDefaults, next: WevuDefaults): WevuDefaults {
  return {
    app: mergeDefaults(base.app, next.app),
    component: mergeDefaults(base.component, next.component),
  }
}

/**
 * 读取 wevu 预设名称。
 */
export function resolveWevuPreset(config?: WeappViteConfig): WevuPresetName | undefined {
  return config?.wevu?.preset as WevuPresetName | undefined
}

/**
 * 根据配置解析最终的 wevu defaults（预设 + 用户配置）。
 */
export function resolveWevuDefaultsWithPreset(config?: WeappViteConfig): WevuDefaults | undefined {
  const userDefaults = config?.wevu?.defaults
  const preset = resolveWevuPreset(config)
  if (preset !== 'performance') {
    return userDefaults
  }
  return mergeWevuDefaults(PERFORMANCE_PRESET_DEFAULTS, userDefaults ?? {})
}

/**
 * 根据配置判断是否启用自动 setData.pick 注入。
 */
export function isAutoSetDataPickEnabledWithPreset(config?: WeappViteConfig): boolean {
  const explicit = config?.wevu?.autoSetDataPick
  if (typeof explicit === 'boolean') {
    return explicit
  }
  return resolveWevuPreset(config) === 'performance'
}
