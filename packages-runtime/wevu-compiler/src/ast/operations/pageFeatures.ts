import type { WevuPageFeatureFlag, WevuPageHookName } from '../../plugins/wevu/pageFeatures/types'
import type { AstEngineName } from '../types'
import { WE_VU_PAGE_HOOK_TO_FEATURE, WE_VU_RUNTIME_MODULE_IDS } from '../../constants'
import { collectWevuPageFeatureFlags } from '../../plugins/wevu/pageFeatures/flags'
import { createModuleAnalysisFromCode } from '../../plugins/wevu/pageFeatures/moduleAnalysis'
import { parseJsLike } from '../../utils/babel'

const CALL_EXPRESSION_TEXT_RE = /\b[a-z_$][\w$]*(?:\s*<[^(){};]+>)?\s*(?:\?\.\s*)?\(/i
const WEVU_PAGE_HOOK_NAMES = Object.keys(WE_VU_PAGE_HOOK_TO_FEATURE) as WevuPageHookName[]

function mayContainWevuPageFeatureHints(code: string) {
  return WE_VU_RUNTIME_MODULE_IDS.some(moduleId => code.includes(moduleId))
    && CALL_EXPRESSION_TEXT_RE.test(code)
    && WEVU_PAGE_HOOK_NAMES.some(hookName => code.includes(hookName))
}

function collectWithBabel(code: string) {
  const ast = parseJsLike(code)
  return collectWevuPageFeatureFlags(ast)
}

function collectWithOxc(code: string) {
  const enabled = new Set<WevuPageFeatureFlag>()
  const module = createModuleAnalysisFromCode('<inline>', code, {
    astEngine: 'oxc',
  })

  if (module.wevuNamedHookLocals.size === 0 && module.wevuNamespaceLocals.size === 0) {
    return enabled
  }

  const visit = (node: any) => {
    if (!node) {
      return
    }

    if (node.type === 'CallExpression') {
      const callee = node.callee
      if (callee?.type === 'Identifier') {
        const matched = module.wevuNamedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
      }
      else if (
        callee?.type === 'MemberExpression'
        && !callee.computed
        && callee.object?.type === 'Identifier'
        && callee.property?.type === 'Identifier'
      ) {
        if (module.wevuNamespaceLocals.has(callee.object.name)) {
          const hook = callee.property.name as WevuPageHookName
          const matched = WE_VU_PAGE_HOOK_TO_FEATURE[hook]
          if (matched) {
            enabled.add(matched)
          }
        }
      }
    }
    else if (node.type === 'ChainExpression') {
      visit(node.expression)
      return
    }

    for (const value of Object.values(node)) {
      if (!value) {
        continue
      }
      if (Array.isArray(value)) {
        for (const child of value) {
          if (child && typeof child === 'object' && typeof child.type === 'string') {
            visit(child)
          }
        }
      }
      else if (typeof value === 'object' && typeof (value as any).type === 'string') {
        visit(value)
      }
    }
  }

  visit(module.ast)
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
  if (!mayContainWevuPageFeatureHints(code)) {
    return new Set<WevuPageFeatureFlag>()
  }

  const engine = options?.astEngine ?? 'babel'

  try {
    return engine === 'oxc' ? collectWithOxc(code) : collectWithBabel(code)
  }
  catch {
    return new Set<WevuPageFeatureFlag>()
  }
}
