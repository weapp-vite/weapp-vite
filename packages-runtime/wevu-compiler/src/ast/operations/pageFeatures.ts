import type { WevuPageFeatureFlag, WevuPageHookName } from '../../plugins/wevu/pageFeatures/types'
import type { AstEngineName } from '../types'
import { collectFeatureFlagsFromCode } from '@weapp-vite/ast'
import { WE_VU_PAGE_HOOK_TO_FEATURE, WE_VU_RUNTIME_MODULE_IDS } from '../../constants'
import { collectWevuPageFeatureFlags } from '../../plugins/wevu/pageFeatures/flags'
import { parseJsLike } from '../../utils/babel'

function collectWithBabel(code: string) {
  const ast = parseJsLike(code)
  return collectWevuPageFeatureFlags(ast)
}

function collectWithOxc(code: string) {
  const enabled = new Set<WevuPageFeatureFlag>()
  for (const moduleId of WE_VU_RUNTIME_MODULE_IDS) {
    const flags = collectFeatureFlagsFromCode(code, {
      astEngine: 'oxc',
      moduleId,
      hookToFeature: WE_VU_PAGE_HOOK_TO_FEATURE as Record<WevuPageHookName, WevuPageFeatureFlag>,
    })
    for (const flag of flags) {
      enabled.add(flag)
    }
  }
  return enabled
}

/**
 * 从源码中收集 wevu 页面特性。
 */
export function collectWevuPageFeatureFlagsFromCode(
  code: string,
  options?: {
    astEngine?: AstEngineName
  },
): Set<WevuPageFeatureFlag> {
  const engine = options?.astEngine ?? 'babel'

  try {
    return engine === 'oxc' ? collectWithOxc(code) : collectWithBabel(code)
  }
  catch {
    return new Set<WevuPageFeatureFlag>()
  }
}
