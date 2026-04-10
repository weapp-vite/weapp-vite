import type { AstEngineName } from '../../types'
import { collectOnPageScrollWarningsWithBabel } from './babel'
import { collectOnPageScrollWarningsWithOxc } from './oxc'

export {
  collectOnPageScrollWarningsWithBabel,
  collectPageScrollInspection,
} from './babel'
export {
  collectOnPageScrollWarningsWithOxc,
  collectPageScrollInspectionWithOxc,
} from './oxc'
export {
  createLineStartOffsets,
  createWarningPrefix,
  getCallExpressionCalleeName,
  getLocationFromOffset,
  getMemberExpressionPropertyName,
  getOnPageScrollCallbackArgument,
  getOxcCallExpressionCalleeName,
  getOxcMemberExpressionPropertyName,
  getOxcStaticPropertyName,
  isOnPageScrollCallee,
  isOxcFunctionLike,
  isOxcOnPageScrollCallee,
  isStaticPropertyName,
} from './shared'

/**
 * 静态检测 onPageScroll 中的常见性能风险并返回告警文案。
 */
export function collectOnPageScrollPerformanceWarnings(
  code: string,
  filename: string,
  options?: {
    engine?: AstEngineName
  },
): string[] {
  if (!code.includes('onPageScroll')) {
    return []
  }

  if (options?.engine === 'oxc') {
    try {
      return collectOnPageScrollWarningsWithOxc(code, filename)
    }
    catch {
      return []
    }
  }

  try {
    return collectOnPageScrollWarningsWithBabel(code, filename)
  }
  catch {
    return []
  }
}
