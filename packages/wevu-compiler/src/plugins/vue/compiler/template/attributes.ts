import type { AttributeNode } from '@vue/compiler-core'
import type { ClassStyleBinding, TransformContext } from './types'
import * as t from '@babel/types'
import { NodeTypes } from '@vue/compiler-core'
import { generate } from '../../../../utils/babel'
import {
  normalizeClassBindingExpression,
  normalizeJsExpressionWithContext,
  normalizeStyleBindingExpression,
  normalizeWxmlExpressionWithContext,
} from './expression'
import { parseBabelExpression } from './expression/parse'
import { renderMustache } from './mustache'

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

function unwrapTsExpression(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node) || t.isTSNonNullExpression(node) || t.isTSTypeAssertion(node)) {
    return unwrapTsExpression(node.expression)
  }
  return node
}

function shouldPreferJsClassStyleRuntime(exp: string): boolean {
  const ast = parseBabelExpression(exp)
  if (!ast) {
    // 表达式无法解析时，为保证行为正确与可调试性，优先走 JS 运行时。
    return true
  }

  const visit = (node: t.Expression): boolean => {
    const current = unwrapTsExpression(node)
    if (
      t.isIdentifier(current)
      || t.isMemberExpression(current)
      || t.isOptionalMemberExpression(current)
      || t.isCallExpression(current)
      || t.isOptionalCallExpression(current)
      || t.isThisExpression(current)
      || t.isSuper(current)
      || t.isAwaitExpression(current)
      || t.isYieldExpression(current)
      || t.isNewExpression(current)
    ) {
      return true
    }
    if (
      t.isStringLiteral(current)
      || t.isNumericLiteral(current)
      || t.isBooleanLiteral(current)
      || t.isNullLiteral(current)
      || t.isBigIntLiteral(current)
      || t.isRegExpLiteral(current)
    ) {
      return false
    }
    if (t.isTemplateLiteral(current)) {
      return current.expressions.some(exp => visit(exp as t.Expression))
    }
    if (t.isArrayExpression(current)) {
      for (const element of current.elements) {
        if (!element || t.isSpreadElement(element)) {
          return true
        }
        if (visit(element as t.Expression)) {
          return true
        }
      }
      return false
    }
    if (t.isObjectExpression(current)) {
      for (const property of current.properties) {
        if (t.isSpreadElement(property) || !t.isObjectProperty(property)) {
          return true
        }
      }
      return false
    }
    if (t.isConditionalExpression(current)) {
      return visit(current.test) || visit(current.consequent) || visit(current.alternate)
    }
    if (t.isLogicalExpression(current) || t.isBinaryExpression(current)) {
      return visit(current.left) || visit(current.right)
    }
    if (t.isUnaryExpression(current)) {
      return visit(current.argument)
    }
    return true
  }

  return visit(ast)
}

function createClassStyleBinding(
  context: TransformContext,
  type: ClassStyleBinding['type'],
  exp: string,
  expAst?: ClassStyleBinding['expAst'],
): ClassStyleBinding {
  const sameTypeCount = context.classStyleBindings.filter(binding => binding.type === type).length
  const name = type === 'class'
    ? `__wv_cls_${sameTypeCount}`
    : type === 'style'
      ? `__wv_style_${sameTypeCount}`
      : `__wv_bind_${sameTypeCount}`
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
  // wxs 模式并不代表“所有表达式都走 wxs”。
  // 当表达式包含复杂/动态访问（如标识符、成员访问、调用等）时，
  // 为避免小程序模板表达式能力差异带来的不一致，这里回退到 js 运行时。
  const useWxsRuntime = context.classStyleRuntime === 'wxs' && !shouldPreferJsClassStyleRuntime(dynamicClassExp)
  if (useWxsRuntime) {
    const normalizedParts = normalizeClassBindingExpression(dynamicClassExp, context)
    for (const part of normalizedParts) {
      parts.push(`(${part})`)
    }
    const mergedExp = parts.length > 1 ? `[${parts.join(',')}]` : parts[0]

    context.classStyleWxs = true
    return `class="${renderMustache(`__weapp_vite.cls(${mergedExp})`, context)}"`
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
  return `class="${renderMustache(`${binding.name}${indexAccess}`, context)}"`
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
  // style 与 class 使用同一套“表达式级回退”规则：
  // - 简单字面量/纯数组对象结构可走 wxs；
  // - 一旦表达式动态性较强，则回退到 js 运行时计算。
  const useWxsRuntime = context.classStyleRuntime === 'wxs'
    && (!dynamicStyleExp || !shouldPreferJsClassStyleRuntime(dynamicStyleExp))
  if (useWxsRuntime) {
    if (dynamicStyleExp) {
      const normalizedParts = normalizeStyleBindingExpression(dynamicStyleExp, context)
      for (const part of normalizedParts) {
        parts.push(`(${part})`)
      }
    }
    if (vShowExp) {
      const normalizedShow = normalizeWxmlExpressionWithContext(vShowExp, context)
      parts.push(`(${normalizedShow}) ? '' : 'display: none'`)
    }
    const mergedExp = parts.length > 1 ? `[${parts.join(',')}]` : (parts[0] || '\'\'')

    context.classStyleWxs = true
    return `style="${renderMustache(`__weapp_vite.style(${mergedExp})`, context)}"`
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
  return `style="${renderMustache(`${binding.name}${indexAccess}`, context)}"`
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
