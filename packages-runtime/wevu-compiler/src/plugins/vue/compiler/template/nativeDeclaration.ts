import type { ElementNode } from '@vue/compiler-core'
import type { ForParseResult, NativeDeclarationScope, TransformContext } from './types'
import {
  WEVU_NATIVE_DECLARATION_ADDRESS_PROP,
  WEVU_NATIVE_DECLARATION_EVENT,
  WEVU_NATIVE_DECLARATION_METHOD,
  WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../utils/babel'
import { recordBindingExpression } from './bindingManifest'
import { INLINE_GLOBALS } from './expression/inlineShared'
import { generateExpression, parseBabelExpressionFile } from './expression/parse'
import { registerRuntimeBindingAst } from './expression/runtimeBinding'
import { renderMustache } from './mustache'

export function usesNativeDeclarationContext(context: TransformContext) {
  return context.platform.name === 'wechat'
    && context.platform.nativeSlotContext !== false
    && context.scopedSlotsRequireProps
}

/** 避免循环参数遮蔽祖先或编译器内建标识符，源码引用通过已有别名重写处理。 */
export function normalizeNativeForAliases(info: ForParseResult, context: TransformContext) {
  if (!usesNativeDeclarationContext(context) || !context.wevuComponentTags?.size) {
    return
  }
  const outerNames = new Set(context.forStack.flatMap(scope => [scope.item, scope.index, scope.key, ...Object.keys(scope.itemAliases ?? {})]))
  const aliases: Record<string, string> = {}
  for (const key of ['item', 'index', 'key'] as const) {
    const name = info[key]
    if (!name || (!outerNames.has(name) && !INLINE_GLOBALS.has(name))) {
      continue
    }
    let replacement: string
    do {
      replacement = `__wv_native_${key}_${context.forIndexSeed++}`
    } while (context.source.includes(replacement))
    aliases[name] = replacement
    info[key] = replacement
  }
  if (!Object.keys(aliases).length) {
    return
  }
  const itemAliases: Record<string, string> = {}
  for (const [name, expression] of Object.entries(info.itemAliases ?? {})) {
    const parsed = parseBabelExpressionFile(expression)
    if (!parsed) {
      continue
    }
    traverse(parsed.ast, {
      Identifier(path) {
        const replacement = aliases[path.node.name]
        if (replacement && path.isReferencedIdentifier() && !path.scope.getBinding(path.node.name)) {
          path.replaceWith(t.identifier(replacement))
          path.skip()
        }
      },
    })
    const statement = parsed.ast.program.body[0]
    if (t.isExpressionStatement(statement)) {
      itemAliases[name] = generateExpression(statement.expression)
    }
  }
  info.nativeAliases = aliases
  info.itemAliases = { ...itemAliases, ...aliases }
}

function createLoopIdentity(info: ForParseResult): t.Expression {
  const key = info.effectiveNativeKey
  if (!key || key.kind === 'position') {
    return t.identifier(info.key ?? info.index ?? 'index')
  }
  const item = t.identifier(info.item ?? 'item')
  const value = key.kind === 'self'
    ? item
    : t.memberExpression(item, t.stringLiteral(key.field), true)
  // 与原生键的字符串语义一致；不序列化 *this 对象内容作为伪身份。
  return t.callExpression(t.identifier('String'), [t.logicalExpression('??', value, t.stringLiteral(''))])
}

export function createNativeDeclaration(node: ElementNode, context: TransformContext): NativeDeclarationScope | undefined {
  if (!usesNativeDeclarationContext(context) || !context.wevuComponentTags?.has(node.tag)) {
    return undefined
  }
  // 结构指令克隆保留 loc，条件切换与遍历次数不会分配新的声明站点。
  const site = `s${node.loc.start.offset}`
  let keyExpression = `'${site}'`
  if (context.forStack.length) {
    const expression = t.callExpression(t.memberExpression(t.identifier('JSON'), t.identifier('stringify')), [
      t.arrayExpression([t.stringLiteral(site), ...context.forStack.map(createLoopIdentity)]),
    ])
    keyExpression = registerRuntimeBindingAst(`native declaration ${site}`, expression, context)
    const outputPath = keyExpression.split('[')[0]
    recordBindingExpression({ ...context, rewriteScopedSlot: false }, {
      kind: 'component-prop',
      expression: outputPath,
      outputPath,
      sourceLocation: node.loc,
    })
  }
  return { site, loopDepth: context.forStack.length, keyExpression }
}

export function appendNativeDeclarationAttributes(attrs: string[], declaration: NativeDeclarationScope, context: TransformContext) {
  const parent = context.nativeDeclarationStack.at(-1)?.keyExpression ?? '\'\''
  attrs.push(`${WEVU_NATIVE_DECLARATION_ADDRESS_PROP}="${renderMustache(`[${declaration.keyExpression},${parent}]`, context)}"`)
  attrs.push(`bind:${WEVU_NATIVE_DECLARATION_EVENT}="${WEVU_NATIVE_DECLARATION_METHOD}"`)
}

export function nativeSlotParentAttribute(context: TransformContext) {
  const parent = context.nativeDeclarationStack.at(-1)?.keyExpression
  return `${WEVU_NATIVE_SLOT_PARENT_DATASET_ATTR}="${parent ? renderMustache(parent, context) : ''}"`
}

export function withNativeDeclarationScope<T>(context: TransformContext, declaration: NativeDeclarationScope | undefined, render: () => T): T {
  if (!declaration) {
    return render()
  }
  context.nativeDeclarationStack.push(declaration)
  try {
    return render()
  }
  finally {
    context.nativeDeclarationStack.pop()
  }
}
