import type { WevuPageFeatureFlag, WevuPageHookName } from '../../plugins/wevu/pageFeatures/types'
import type { AstEngineName } from '../types'
import { parseSync } from 'oxc-parser'
import { walk } from 'oxc-walker'
import { WE_VU_MODULE_ID, WE_VU_PAGE_HOOK_TO_FEATURE } from '../../constants'
import { collectWevuPageFeatureFlags } from '../../plugins/wevu/pageFeatures/flags'
import { parseJsLike } from '../../utils/babel'

function collectWithBabel(code: string) {
  const ast = parseJsLike(code)
  return collectWevuPageFeatureFlags(ast)
}

function collectWithOxc(code: string) {
  const ast = parseSync('inline.ts', code).program as any
  const namedHookLocals = new Map<string, WevuPageFeatureFlag>()
  const namespaceLocals = new Set<string>()

  for (const statement of ast.body ?? []) {
    if (statement?.type !== 'ImportDeclaration' || statement.source?.value !== WE_VU_MODULE_ID) {
      continue
    }
    for (const specifier of statement.specifiers ?? []) {
      if (specifier.type === 'ImportSpecifier' && specifier.imported?.type === 'Identifier') {
        const importedName = specifier.imported.name as WevuPageHookName
        const matched = WE_VU_PAGE_HOOK_TO_FEATURE[importedName]
        if (matched && specifier.local?.type === 'Identifier') {
          namedHookLocals.set(specifier.local.name, matched)
        }
      }
      else if (specifier.type === 'ImportNamespaceSpecifier' && specifier.local?.type === 'Identifier') {
        namespaceLocals.add(specifier.local.name)
      }
    }
  }

  if (namedHookLocals.size === 0 && namespaceLocals.size === 0) {
    return new Set<WevuPageFeatureFlag>()
  }

  const enabled = new Set<WevuPageFeatureFlag>()

  walk(ast, {
    enter(node) {
      if (node.type !== 'CallExpression') {
        return
      }

      const callee = node.callee as any
      if (callee?.type === 'Identifier') {
        const matched = namedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
        return
      }

      if (
        callee?.type === 'MemberExpression'
        && callee.object?.type === 'Identifier'
        && callee.property?.type === 'Identifier'
        && namespaceLocals.has(callee.object.name)
      ) {
        const matched = (WE_VU_PAGE_HOOK_TO_FEATURE as Record<string, WevuPageFeatureFlag | undefined>)[callee.property.name]
        if (matched) {
          enabled.add(matched)
        }
      }
    },
  })

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
