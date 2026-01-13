import type { AttributeNode } from '@vue/compiler-core'
import type { ClassStyleBinding, TransformContext } from './types'
import * as t from '@babel/types'
import { NodeTypes } from '@vue/compiler-core'
import { generate } from '../../../../utils/babel'
import { normalizeJsExpressionWithContext, normalizeWxmlExpressionWithContext } from './expression'

function toWxmlStringLiteral(value: string) {
  const escaped = value
    .replace(/\\/g, '\\\\')
    .replace(/'/g, '\\\'')
    .replace(/\r/g, '\\r')
    .replace(/\n/g, '\\n')
  return `'${escaped}'`
}

function cloneForStack(context: TransformContext) {
  return context.forStack.map(info => ({ ...info }))
}

function buildForIndexAccess(context: TransformContext): string {
  if (!context.forStack.length) {
    return ''
  }
  return context.forStack
    .map(info => `[${info.index ?? 'index'}]`)
    .join('')
}

function generateExpressionCode(exp: t.Expression) {
  const { code } = generate(exp, { compact: true })
  return code
}

function mergeJsExpressionParts(parts: t.Expression[]) {
  if (!parts.length) {
    return t.stringLiteral('')
  }
  if (parts.length === 1) {
    return parts[0]
  }
  return t.arrayExpression(parts)
}

function createClassStyleBinding(
  context: TransformContext,
  type: ClassStyleBinding['type'],
  exp: string,
  expAst?: ClassStyleBinding['expAst'],
): ClassStyleBinding {
  const index = context.classStyleBindings.length
  const name = type === 'class'
    ? `__wv_cls_${index}`
    : `__wv_style_${index}`
  return {
    name,
    type,
    exp,
    expAst,
    forStack: cloneForStack(context),
  }
}

export function renderClassAttribute(
  staticClass: string | undefined,
  dynamicClassExp: string | undefined,
  context: TransformContext,
): string | undefined {
  const staticValue = staticClass?.trim()
  if (!dynamicClassExp) {
    return staticValue ? `class="${staticValue}"` : undefined
  }

  const parts = []
  if (staticValue) {
    parts.push(toWxmlStringLiteral(staticValue))
  }
  if (context.classStyleRuntime === 'wxs') {
    const normalizedDynamic = normalizeWxmlExpressionWithContext(dynamicClassExp, context)
    parts.push(`(${normalizedDynamic})`)
    const mergedExp = parts.length > 1 ? `[${parts.join(',')}]` : parts[0]

    context.classStyleWxs = true
    return `class="{{__weapp_vite.cls(${mergedExp})}}"`
  }

  const jsParts: t.Expression[] = []
  if (staticValue) {
    jsParts.push(t.stringLiteral(staticValue))
  }
  const dynamicAst = normalizeJsExpressionWithContext(dynamicClassExp, context, { hint: 'class 绑定' })
  if (dynamicAst) {
    jsParts.push(dynamicAst)
  }
  const expAst = mergeJsExpressionParts(jsParts)
  const exp = generateExpressionCode(expAst)
  const binding = createClassStyleBinding(context, 'class', exp, expAst)
  context.classStyleBindings.push(binding)
  const indexAccess = buildForIndexAccess(context)
  return `class="{{${binding.name}${indexAccess}}}"`
}

export function renderStyleAttribute(
  staticStyle: string | undefined,
  dynamicStyleExp: string | undefined,
  vShowExp: string | undefined,
  context: TransformContext,
): string | undefined {
  const staticValue = staticStyle?.trim()
  const hasDynamic = Boolean(dynamicStyleExp || vShowExp)
  if (!hasDynamic) {
    return staticValue ? `style="${staticValue}"` : undefined
  }

  const parts: string[] = []
  if (staticValue) {
    parts.push(toWxmlStringLiteral(staticValue))
  }
  if (context.classStyleRuntime === 'wxs') {
    if (dynamicStyleExp) {
      const normalizedStyle = normalizeWxmlExpressionWithContext(dynamicStyleExp, context)
      parts.push(`(${normalizedStyle})`)
    }
    if (vShowExp) {
      const normalizedShow = normalizeWxmlExpressionWithContext(vShowExp, context)
      parts.push(`(${normalizedShow}) ? '' : 'display: none'`)
    }
    const mergedExp = parts.length > 1 ? `[${parts.join(',')}]` : (parts[0] || '\'\'')

    context.classStyleWxs = true
    return `style="{{__weapp_vite.style(${mergedExp})}}"`
  }

  const jsParts: t.Expression[] = []
  if (staticValue) {
    jsParts.push(t.stringLiteral(staticValue))
  }
  if (dynamicStyleExp) {
    const dynamicAst = normalizeJsExpressionWithContext(dynamicStyleExp, context, { hint: 'style 绑定' })
    if (dynamicAst) {
      jsParts.push(dynamicAst)
    }
  }
  if (vShowExp) {
    const showAst = normalizeJsExpressionWithContext(vShowExp, context, { hint: 'v-show' })
    if (showAst) {
      jsParts.push(t.conditionalExpression(
        showAst,
        t.stringLiteral(''),
        t.stringLiteral('display: none'),
      ))
    }
  }
  const expAst = mergeJsExpressionParts(jsParts)
  const exp = generateExpressionCode(expAst)
  const binding = createClassStyleBinding(context, 'style', exp, expAst)
  context.classStyleBindings.push(binding)
  const indexAccess = buildForIndexAccess(context)
  return `style="{{${binding.name}${indexAccess}}}"`
}

export function transformAttribute(node: AttributeNode, _context: TransformContext): string {
  const { name, value } = node

  if (!value) {
    return name
  }

  // 处理静态属性
  if (value.type === NodeTypes.TEXT) {
    return `${name}="${value.content}"`
  }

  return `${name}=""`
}
