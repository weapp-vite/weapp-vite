import type { DirectiveNode } from '@vue/compiler-core'
import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { ForParseResult, TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { getBindDirectiveExpression } from '../elements/helpers'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { parseBabelExpression } from '../expression/parse'
import { registerRuntimeBindingExpression, shouldFallbackToRuntimeBinding } from '../expression/runtimeBinding'
import { renderMustache } from '../mustache'

function unwrapTsExpression(node: Expression): Expression {
  if (node.type === 'TSAsExpression' || node.type === 'TSNonNullExpression' || node.type === 'TSTypeAssertion') {
    return unwrapTsExpression(node.expression as Expression)
  }
  return node
}

function isTopLevelObjectLiteral(exp: string) {
  const parsed = parseBabelExpression(exp)
  if (!parsed) {
    return false
  }
  const normalized = unwrapTsExpression(parsed)
  return normalized.type === 'ObjectExpression'
}

function createBindRuntimeAttr(argValue: string, rawExpValue: string, context: TransformContext): string | null {
  const bindingRef = registerRuntimeBindingExpression(rawExpValue, context, { hint: `:${argValue} 绑定` })
  if (!bindingRef) {
    return null
  }
  return `${argValue}="${renderMustache(bindingRef, context)}"`
}

function createInlineObjectLiteralAttr(argValue: string, rawExpValue: string, context: TransformContext): string {
  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context).trim()
  if (context.mustacheInterpolation === 'spaced') {
    return `${argValue}="${renderMustache(expValue, context)}"`
  }
  return `${argValue}="{{ ${expValue} }}"`
}

const SIMPLE_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const SIMPLE_MEMBER_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i

const isSimpleIdentifier = (value: string) => SIMPLE_IDENTIFIER_RE.test(value)
const isSimpleMemberPath = (value: string) => SIMPLE_MEMBER_PATH_RE.test(value)

const COMPONENT_NON_PROP_BINDINGS = new Set([
  'class',
  'style',
  'id',
  'key',
  'ref',
  'is',
  'slot',
  'layout-host',
])

function collectFunctionPropPath(rawExpValue: string): string | null {
  const parsed = parseBabelExpression(rawExpValue)
  if (!parsed) {
    return null
  }
  const normalized = unwrapTsExpression(parsed)
  if (normalized.type === 'Identifier') {
    return normalized.name
  }
  if (normalized.type !== 'MemberExpression' || normalized.computed) {
    return null
  }

  const parts: string[] = []
  let current: Expression = normalized
  while (current.type === 'MemberExpression' && !current.computed) {
    if (current.property.type !== 'Identifier') {
      return null
    }
    parts.unshift(current.property.name)
    current = unwrapTsExpression(current.object as Expression)
  }
  if (current.type !== 'Identifier') {
    return null
  }
  parts.unshift(current.name)
  return parts.join('.')
}

function isComputedMemberExpression(rawExpValue: string): boolean {
  const parsed = parseBabelExpression(rawExpValue)
  if (!parsed) {
    return false
  }
  const normalized = unwrapTsExpression(parsed)
  return normalized.type === 'MemberExpression' && normalized.computed
}

function isEventCompatiblePropName(argValue: string) {
  return argValue === 'change' || /^on[-:_A-Z]/.test(argValue)
}

function shouldUseRuntimeFunctionPropBinding(argValue: string, context: TransformContext) {
  return isEventCompatiblePropName(argValue) || context.functionPropNames.has(argValue)
}

function shouldWrapStaticMemberFunctionProp(argValue: string, path: string, context: TransformContext) {
  return path.includes('.') && shouldUseRuntimeFunctionPropBinding(argValue, context)
}

function createFunctionPropRuntimeAttr(argValue: string, rawExpValue: string, context: TransformContext): string | null {
  const bindingRef = registerRuntimeBindingExpression(rawExpValue, context, { hint: `:${argValue} 函数 prop 绑定` })
  if (!bindingRef) {
    return null
  }
  const bindingName = bindingRef.split('[')[0] || bindingRef
  context.functionPropPaths.add(bindingName)
  return `${argValue}="${renderMustache(bindingRef, context)}"`
}

export function transformBindDirective(
  node: DirectiveNode,
  context: TransformContext,
  forInfo?: ForParseResult,
  options?: { isComponent?: boolean },
): string | null {
  const { arg } = node
  if (!arg) {
    return null
  }
  const argValue = arg.type === NodeTypes.SIMPLE_EXPRESSION ? arg.content : ''
  const rawExpValue = getBindDirectiveExpression(node)
  if (!rawExpValue) {
    return null
  }

  if (options?.isComponent && !COMPONENT_NON_PROP_BINDINGS.has(argValue)) {
    const path = collectFunctionPropPath(rawExpValue)
    if (path) {
      if (shouldWrapStaticMemberFunctionProp(argValue, path, context)) {
        const runtimeAttr = createFunctionPropRuntimeAttr(argValue, rawExpValue, context)
        if (runtimeAttr) {
          return runtimeAttr
        }
      }
      else {
        context.functionPropPaths.add(path)
      }
    }
    else if (shouldUseRuntimeFunctionPropBinding(argValue, context) && isComputedMemberExpression(rawExpValue)) {
      const runtimeAttr = createFunctionPropRuntimeAttr(argValue, rawExpValue, context)
      if (runtimeAttr) {
        return runtimeAttr
      }
    }
  }

  if (argValue === 'key') {
    const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)
    const trimmed = expValue.trim()
    const warnKeyFallback = (reason: string) => {
      if (!forInfo) {
        return
      }
      context.warnings.push(
        `v-for :key "${trimmed}" ${reason}，已降级为 ${context.platform.keyAttr(context.platform.keyThisValue)}。`
        + '建议使用稳定的基础类型 key（例如 item.id）。',
      )
    }
    if (forInfo?.item && trimmed === forInfo.item) {
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    if (forInfo?.key && trimmed === forInfo.key) {
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    if (forInfo?.item && trimmed.startsWith(`${forInfo.item}.`)) {
      const remainder = trimmed.slice(forInfo.item.length + 1)
      if (isSimpleMemberPath(remainder)) {
        const firstSegment = remainder.split('.')[0] || remainder
        return context.platform.keyAttr(firstSegment)
      }
      warnKeyFallback('不是简单的成员路径')
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    if (isSimpleIdentifier(trimmed)) {
      return context.platform.keyAttr(trimmed)
    }
    if (forInfo) {
      warnKeyFallback('是复杂表达式')
      return context.platform.keyAttr(context.platform.keyThisValue)
    }
    return context.platform.keyAttr(expValue)
  }

  if (isTopLevelObjectLiteral(rawExpValue)) {
    if (context.objectLiteralBindMode === 'inline') {
      return createInlineObjectLiteralAttr(argValue, rawExpValue, context)
    }
    return createBindRuntimeAttr(argValue, rawExpValue, context)
  }

  if (shouldFallbackToRuntimeBinding(rawExpValue)) {
    const runtimeAttr = createBindRuntimeAttr(argValue, rawExpValue, context)
    if (runtimeAttr) {
      return runtimeAttr
    }
  }

  const expValue = normalizeWxmlExpressionWithContext(rawExpValue, context)

  return `${argValue}="${renderMustache(expValue, context)}"`
}
