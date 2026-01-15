import type { FunctionLike, ModuleAnalysis } from '../moduleAnalysis'
import type { WevuPageFeatureFlag, WevuPageHookName } from '../types'
import * as t from '@babel/types'
import { WE_VU_PAGE_HOOK_TO_FEATURE } from 'wevu/compiler'

export function collectWevuHookCallsInFunctionBody(module: ModuleAnalysis, fn: FunctionLike): Set<WevuPageFeatureFlag> {
  const enabled = new Set<WevuPageFeatureFlag>()

  t.traverseFast(fn, (node) => {
    if (t.isCallExpression(node)) {
      const callee = node.callee
      if (t.isIdentifier(callee)) {
        const matched = module.wevuNamedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
        if (!module.wevuNamespaceLocals.has(callee.object.name)) {
          return
        }
        const hook = callee.property.name as WevuPageHookName
        const matched = WE_VU_PAGE_HOOK_TO_FEATURE[hook]
        if (matched) {
          enabled.add(matched)
        }
      }
    }
    else if (t.isOptionalCallExpression(node)) {
      const callee = node.callee
      if (t.isIdentifier(callee)) {
        const matched = module.wevuNamedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
        return
      }
      if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
        if (!module.wevuNamespaceLocals.has(callee.object.name)) {
          return
        }
        const hook = callee.property.name as WevuPageHookName
        const matched = WE_VU_PAGE_HOOK_TO_FEATURE[hook]
        if (matched) {
          enabled.add(matched)
        }
      }
    }
  })

  return enabled
}
