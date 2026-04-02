import type { WevuPageFeatureFlag, WevuPageHookName } from '../../plugins/wevu/pageFeatures/types'
import type { AstEngineName } from '../types'
import { collectFeatureFlagsFromCode } from '@weapp-vite/ast'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE } from '../../constants'
import { collectWevuPageFeatureFlags } from '../../plugins/wevu/pageFeatures/flags'
import { parseJsLike } from '../../utils/babel'

function collectWithBabel(code: string) {
  const ast = parseJsLike(code)
  return collectWevuPageFeatureFlags(ast)
}

function collectWithOxc(code: string) {
  return collectFeatureFlagsFromCode(code, {
    astEngine: 'oxc',
    moduleId: WE_VU_MODULE_ID,
    hookToFeature: WE_VU_PAGE_HOOK_TO_FEATURE as Record<WevuPageHookName, WevuPageFeatureFlag>,
  })
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
