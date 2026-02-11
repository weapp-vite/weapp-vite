import type { WevuPageFeatureFlag } from './types'

const FEATURE_TO_PAGE_CONFIG_KEY: Partial<Record<WevuPageFeatureFlag, 'enableShareAppMessage' | 'enableShareTimeline'>> = {
  enableOnShareAppMessage: 'enableShareAppMessage',
  enableOnShareTimeline: 'enableShareTimeline',
}

export function mergePageConfigFromFeatures(
  config: Record<string, any> | undefined,
  enabledFeatures: Iterable<WevuPageFeatureFlag> | undefined,
  options?: { isPage?: boolean },
): Record<string, any> | undefined {
  if (!options?.isPage || !enabledFeatures) {
    return config
  }

  let next = config

  for (const feature of enabledFeatures) {
    const configKey = FEATURE_TO_PAGE_CONFIG_KEY[feature]
    if (!configKey) {
      continue
    }

    if (!next) {
      next = {}
    }

    if (next[configKey] !== true) {
      next[configKey] = true
    }
  }

  return next
}
