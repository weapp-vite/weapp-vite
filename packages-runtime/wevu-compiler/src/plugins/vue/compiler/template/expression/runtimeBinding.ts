import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { TransformContext } from '../types'
import { traverse } from '../../../../../utils/babel'
import { normalizeJsExpressionWithContext } from './js'
import { parseBabelExpressionFile } from './parse'
import { normalizeWxmlExpression } from './wxml'

/** 微信 WXML 不能解析括号表达式后的成员或下标访问。 */
const WXML_PARENTHESIZED_MEMBER_RE = /\)\s*(?:\.|\[)/

function buildForIndexAccess(context: TransformContext): string {
  if (!context.forStack.length) {
    return ''
  }
  return context.forStack
    .map(info => `[${info.index ?? 'index'}]`)
    .join('')
}

/**
 * 检测规范化后的 WXML 表达式是否包含非法的括号成员访问。
 */
export function hasWxmlParenthesizedMemberAccess(exp: string): boolean {
  const trimmed = exp.trim()
  if (!trimmed) {
    return false
  }
  return WXML_PARENTHESIZED_MEMBER_RE.test(normalizeWxmlExpression(trimmed))
}

/**
 * 检测表达式是否包含小程序模板不稳定或非法的语义。
 */
export function shouldFallbackToRuntimeBinding(
  exp: string,
  templateSafeCallNames: ReadonlySet<string> = new Set(),
  context?: TransformContext,
): boolean {
  const trimmed = exp.trim()
  if (!trimmed) {
    return false
  }
  if (hasWxmlParenthesizedMemberAccess(trimmed)) {
    return true
  }
  const normalized = normalizeWxmlExpression(trimmed)
  const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {
    return false
  }

  let shouldFallback = false
  const visitor: Parameters<typeof traverse>[1] = {
    CallExpression(path) {
      if (
        path.node.callee.type === 'Identifier'
        && templateSafeCallNames.has(path.node.callee.name)
      ) {
        return
      }
      shouldFallback = true
      path.stop()
    },
    OptionalCallExpression(path) {
      shouldFallback = true
      path.stop()
    },
    UnaryExpression(path) {
      if (path.node.operator !== 'typeof') {
        return
      }
      shouldFallback = true
      path.stop()
    },
    BigIntLiteral(path) {
      shouldFallback = true
      path.stop()
    },
  }
  if (context?.scriptSetupPropConflicts?.length) {
    visitor.Identifier = (path) => {
      const name = path.node.name
      if (context.scriptSetupPropConflicts!.includes(name) && path.isReferencedIdentifier()
        && !context.scopeStack.some(scope => scope.has(name))
        && !context.slotPropStack.some(scope => Object.hasOwn(scope, name))
        && !path.scope.hasBinding(name)) {
        shouldFallback = true
        path.stop()
      }
    }
  }
  traverse(parsed.ast, visitor)
  return shouldFallback
}

/** 内部绑定下标已是原生别名，不再应用源码遮蔽映射；对象循环使用原生条目坐标。 */
export function normalizeRuntimeBindingReference(exp: string, context: TransformContext) {
  return normalizeJsExpressionWithContext(exp, {
    ...context,
    forStack: context.forStack.map(info => ({
      ...info,
      itemAccess: undefined,
      itemAliases: info.index && info.key ? { [info.index]: info.key } : undefined,
    })),
  }, {
    hint: '内部循环绑定',
    runtimePropAccess: 'helper',
    unrefMemberAccess: true,
    preserveForItems: true,
  })
}

/** 注册已解析的内部表达式，避免把编译器标识符重写到插槽表达式 owner。 */
export function registerRuntimeBindingAst(exp: string, expAst: Expression, context: TransformContext): string {
  const binding = {
    name: `__wv_bind_${context.classStyleBindings.filter(item => item.type === 'bind').length}`,
    type: 'bind' as const,
    exp,
    expAst,
    forStack: context.forStack.map(info => ({ ...info })),
    conditions: context.bindingConditions?.slice(),
  }
  context.classStyleBindings.push(binding)

  return `${binding.name}${buildForIndexAccess(context)}`
}

/**
 * 将复杂表达式注册为 JS 运行时计算绑定，返回可用于模板 mustache 的绑定引用。
 */
export function registerRuntimeBindingExpression(
  exp: string,
  context: TransformContext,
  options?: { hint?: string },
): string | null {
  const expAst = normalizeJsExpressionWithContext(exp, context, {
    ...options,
    runtimePropAccess: 'helper',
    unrefMemberAccess: true,
  })
  if (!expAst) {
    return null
  }

  return registerRuntimeBindingAst(exp, expAst, context)
}
