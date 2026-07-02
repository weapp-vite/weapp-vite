import type { NativeOnPageScrollDiagnostic } from '../../native'
import type { AstEngineName } from '../../types'
import { loadNativeAstBindingSync, shouldUseNativeAst } from '../../native'
import { collectOnPageScrollWarningsWithBabel } from './babel'
import { collectOnPageScrollWarningsWithOxc } from './oxc'
import { createWarningPrefix } from './shared'

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

function formatNativeOnPageScrollWarning(
  diagnostic: NativeOnPageScrollDiagnostic,
  filename: string,
) {
  const prefix = createWarningPrefix(filename, diagnostic.line, diagnostic.column)
  if (diagnostic.kind === 'empty') {
    return `${prefix} 检测到空的 ${diagnostic.sourceLabel} 回调，建议移除无效监听以降低滚动时调度开销。`
  }
  if (diagnostic.kind === 'setData') {
    return `${prefix} 检测到 ${diagnostic.sourceLabel} 内调用 setData，建议改用节流、IntersectionObserver 或合并更新。`
  }
  return `${prefix} 检测到 ${diagnostic.sourceLabel} 内调用同步 API（${diagnostic.syncApi ?? 'wx.*Sync'}），可能阻塞渲染线程。`
}

export function collectOnPageScrollWarningsWithNative(
  code: string,
  filename: string,
) {
  const binding = loadNativeAstBindingSync()
  const collectNative = binding?.collectOnPageScrollDiagnosticsNative
  if (!collectNative) {
    return undefined
  }
  const warnings: string[] = []
  const warningSet = new Set<string>()
  for (const diagnostic of collectNative(code, filename)) {
    const warning = formatNativeOnPageScrollWarning(diagnostic, filename)
    if (warningSet.has(warning)) {
      continue
    }
    warningSet.add(warning)
    warnings.push(warning)
  }
  return warnings
}

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

  if (shouldUseNativeAst()) {
    try {
      const warnings = collectOnPageScrollWarningsWithNative(code, filename)
      if (warnings) {
        return warnings
      }
    }
    catch {
      // native AST 是可选快速路径，失败时回退 Babel。
    }
  }

  try {
    return collectOnPageScrollWarningsWithBabel(code, filename)
  }
  catch {
    return []
  }
}
