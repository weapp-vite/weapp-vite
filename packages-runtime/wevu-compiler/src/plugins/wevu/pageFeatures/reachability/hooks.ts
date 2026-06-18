import type { FunctionLike, ModuleAnalysis } from '../moduleAnalysis'
import type { WevuPageFeatureFlag, WevuPageHookName } from '../types'
import * as t from '@weapp-vite/ast/babelTypes'
import { WE_VU_PAGE_HOOK_TO_FEATURE } from '../../../../constants'

function getMemberHookName(callee: t.CallExpression['callee']): { object: string, hook: WevuPageHookName } | null {
  if (t.isMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
    return { object: callee.object.name, hook: callee.property.name as WevuPageHookName }
  }
  if (t.isOptionalMemberExpression(callee) && !callee.computed && t.isIdentifier(callee.object) && t.isIdentifier(callee.property)) {
    return { object: callee.object.name, hook: callee.property.name as WevuPageHookName }
  }
  return null
}

function addNamespaceHookFeature(module: ModuleAnalysis, callee: t.CallExpression['callee'], enabled: Set<WevuPageFeatureFlag>) {
  const memberHook = getMemberHookName(callee)
  if (!memberHook || !module.wevuNamespaceLocals.has(memberHook.object)) {
    return
  }
  const matched = WE_VU_PAGE_HOOK_TO_FEATURE[memberHook.hook]
  if (matched) {
    enabled.add(matched)
  }
}

export function collectWevuHookCallsInFunctionBody(module: ModuleAnalysis, fn: FunctionLike): Set<WevuPageFeatureFlag> {
  const enabled = new Set<WevuPageFeatureFlag>()

  if (module.engine === 'oxc') {
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

    visit(fn)
    return enabled
  }

  t.traverseFast(fn as t.Node, (node) => {
    if (t.isCallExpression(node)) {
      const callee = node.callee
      if (t.isIdentifier(callee)) {
        const matched = module.wevuNamedHookLocals.get(callee.name)
        if (matched) {
          enabled.add(matched)
        }
        return
      }
      addNamespaceHookFeature(module, callee, enabled)
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
      addNamespaceHookFeature(module, callee, enabled)
    }
  })

  return enabled
}
