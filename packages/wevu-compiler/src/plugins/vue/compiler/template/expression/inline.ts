import type { InlineExpressionAsset, TransformContext } from '../types'
import * as t from '@babel/types'
import { traverse } from '../../../../../utils/babel'
import { generateExpression, parseBabelExpressionFile } from './parse'
import { collectScopedSlotLocals, collectSlotPropMapping } from './scopedSlot'

const INLINE_GLOBALS = new Set([
  'Math',
  'Number',
  'Date',
  'Array',
  'Object',
  'Boolean',
  'String',
  'RegExp',
  'Map',
  'Set',
  'JSON',
  'Intl',
  'Promise',
  'console',
  'Infinity',
  'undefined',
  'NaN',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'require',
  'arguments',
  '__weapp_vite',
  'globalThis',
  'setTimeout',
  'clearTimeout',
  'setInterval',
  'clearInterval',
  'wx',
  'Page',
  'App',
  'Component',
  'requirePlugin',
  'getApp',
  'getCurrentPages',
  'WechatMiniprogram',
  'ctx',
  'scope',
])

function createMemberAccess(target: string, prop: string): t.MemberExpression {
  if (/^[A-Z_$][\w$]*$/i.test(prop)) {
    return t.memberExpression(t.identifier(target), t.identifier(prop))
  }
  return t.memberExpression(t.identifier(target), t.stringLiteral(prop), true)
}

function resolveSlotPropBinding(slotProps: Record<string, string>, name: string): string | null {
  if (!Object.prototype.hasOwnProperty.call(slotProps, name)) {
    return null
  }
  const prop = slotProps[name]
  if (!prop) {
    return '__wvSlotPropsData'
  }
  return generateExpression(createMemberAccess('__wvSlotPropsData', prop))
}

export interface InlineExpressionBinding {
  id: string
  scopeBindings: string[]
}

export function registerInlineExpression(exp: string, context: TransformContext): InlineExpressionBinding | null {
  const parsed = parseBabelExpressionFile(exp)
  if (!parsed) {
    return null
  }
  const { ast, expression } = parsed
  const locals = collectScopedSlotLocals(context)
  const slotProps = collectSlotPropMapping(context)
  for (const name of Object.keys(slotProps)) {
    locals.add(name)
  }

  const usedLocals: string[] = []
  const usedLocalSet = new Set<string>()

  const markLocal = (name: string) => {
    if (usedLocalSet.has(name)) {
      return
    }
    usedLocalSet.add(name)
    usedLocals.push(name)
  }

  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (name === '$event') {
        return
      }
      if (name === 'ctx' || name === 'scope') {
        return
      }
      if (path.scope.hasBinding(name)) {
        return
      }
      if (locals.has(name)) {
        markLocal(name)
        path.replaceWith(createMemberAccess('scope', name))
        return
      }
      if (INLINE_GLOBALS.has(name)) {
        return
      }
      path.replaceWith(createMemberAccess('ctx', name))
    },
    ThisExpression(path) {
      path.replaceWith(t.identifier('ctx'))
    },
  })

  const updatedExpression = generateExpression(expression)
  const scopeBindings = usedLocals.map((name) => {
    const slotBinding = resolveSlotPropBinding(slotProps, name)
    return slotBinding ?? name
  })
  const asset: InlineExpressionAsset = {
    id: `__wv_inline_${context.inlineExpressionSeed++}`,
    expression: updatedExpression,
    scopeKeys: usedLocals,
  }
  context.inlineExpressions.push(asset)

  return {
    id: asset.id,
    scopeBindings,
  }
}
