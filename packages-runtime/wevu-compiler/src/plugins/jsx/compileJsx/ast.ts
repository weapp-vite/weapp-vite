import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type {
  Expression,
  JSXIdentifier,
  JSXNamespacedName,
} from '@weapp-vite/ast/babelTypes'
import type { JsxCompileContext } from './types'
import { escapeWxmlAttribute, escapeWxmlText } from '@weapp-core/shared'
import {
  getObjectPropertyByKey,
  resolveRenderableExpression,
  toStaticObjectKey,
  unwrapTypeScriptExpression,
} from '@weapp-vite/ast'
import * as t from '@weapp-vite/ast/babelTypes'
import { createInlineExpressionId } from '../../../inlineDataset'
import { generate, traverse } from '../../../utils/babel'
import { createInlineExpressionParameterIdentifiers } from '../../vue/compiler/template/expression/inlineShared'
import { shouldFallbackToRuntimeBinding } from '../../vue/compiler/template/expression/runtimeBinding'
import { normalizeWxmlExpression } from '../../vue/compiler/template/expression/wxml'

const WXML_EXPRESSION_GENERATE_OPTIONS = {
  compact: true,
  jsescOption: { quotes: 'single' as const, minimal: true },
}

export const escapeText = escapeWxmlText
export const escapeAttr = escapeWxmlAttribute

const WHITESPACE_RE = /\s+/g

export function normalizeJsxText(value: string) {
  return value.replace(WHITESPACE_RE, ' ')
}

export function printExpression(exp: Expression) {
  const normalized = t.cloneNode(exp, true) as Expression
  t.traverseFast(normalized, (node) => {
    if (t.isStringLiteral(node)) {
      node.extra = undefined
    }
  })
  return generate(normalized, WXML_EXPRESSION_GENERATE_OPTIONS).code
}

export function unwrapTsExpression(exp: Expression): Expression {
  return unwrapTypeScriptExpression(exp)
}

export { getObjectPropertyByKey, resolveRenderableExpression, toStaticObjectKey }

export function normalizeInterpolationExpression(exp: Expression, context?: JsxCompileContext) {
  const cached = context?.interpolationCache.get(exp)
  if (cached != null) {
    return cached
  }
  let source = printExpression(unwrapTsExpression(exp))
  if (context?.setupRefBindings?.size) {
    const expression = t.cloneNode(unwrapTsExpression(exp), true)
    const file = t.file(t.program([t.expressionStatement(expression)]))
    traverse(file, {
      'MemberExpression|OptionalMemberExpression': {
        enter(path) {
          const member = path.node
          if (!t.isMemberExpression(member) && !t.isOptionalMemberExpression(member)) {
            return
          }
          const object = t.isExpression(member.object) ? unwrapTsExpression(member.object) : member.object
          if (!t.isIdentifier(object) || !context.setupRefBindings?.has(object.name)
            || context.scopeStack.includes(object.name) || path.scope.hasBinding(object.name)) {
            return
          }
          if (member.loc?.filename && context.filename && member.loc.filename !== context.filename) {
            return
          }
          const valueAccess = member.computed ? t.isStringLiteral(member.property, { value: 'value' }) : t.isIdentifier(member.property, { name: 'value' })
          if (valueAccess) {
            path.replaceWith(t.cloneNode(object))
          }
        },
      },
    })
    const statement = file.program.body[0] as t.ExpressionStatement
    source = printExpression(statement.expression)
  }
  let normalized = normalizeWxmlExpression(source)
  if (context && shouldFallbackToRuntimeBinding(source)) {
    const name = `__wv_bind_${context.classStyleBindings.filter(item => item.type === 'bind').length}`
    context.classStyleBindings.push({
      name,
      type: 'bind',
      exp: source,
      forStack: context.forStack.map(info => ({ ...info })),
    })
    const indexAccess = context.forStack.map(info => `[${info.index ?? 'index'}]`).join('')
    normalized = `${name}${indexAccess}`
  }
  context?.interpolationCache.set(exp, normalized)
  return normalized
}

export function renderMustache(expression: string, context: Pick<JsxCompileContext, 'mustacheInterpolation'>) {
  return context.mustacheInterpolation === 'spaced'
    ? `{{ ${expression} }}`
    : `{{${expression}}}`
}

export function pushScope(context: JsxCompileContext, names: string[], sourceExpression: string) {
  const scopedNames = names.filter(Boolean)
  const sourceLocals = [...context.scopeStack]
  context.scopeStack.push(...scopedNames)
  if (scopedNames.length) {
    context.bindingScopeStack.push({
      locals: scopedNames,
      sourceExpression,
      sourceLocals,
    })
  }
}

export function popScope(context: JsxCompileContext, count: number) {
  for (let i = 0; i < count; i += 1) {
    context.scopeStack.pop()
  }
  if (count > 0) {
    context.bindingScopeStack.pop()
  }
}

function analyzeInlineExpression(exp: Expression, context: JsxCompileContext) {
  const localSet = new Set(context.scopeStack)
  const used: string[] = []
  const usedSet = new Set<string>()
  const identifierNames = new Set<string>()
  const normalizedExpression = t.cloneNode(exp, true) as Expression
  const file = t.file(t.program([t.expressionStatement(normalizedExpression)]))
  let programScope: Scope | undefined

  traverse(file, {
    Program(path) {
      programScope = path.scope
    },
    Identifier(path) {
      const name = path.node.name
      identifierNames.add(name)
      if (
        !localSet.has(name)
        || !path.isReferencedIdentifier()
        || path.scope.hasBinding(name)
        || usedSet.has(name)
      ) {
        return
      }
      usedSet.add(name)
      used.push(name)
    },
    StringLiteral(path) {
      path.node.extra = undefined
    },
  })
  if (!programScope) {
    throw new Error('无法为 JSX 内联表达式创建程序作用域。')
  }

  return {
    parameterIdentifiers: createInlineExpressionParameterIdentifiers(
      programScope,
      identifierNames,
    ),
    normalizedExpression,
    scopeKeys: used,
  }
}

export function registerInlineExpression(exp: Expression, context: JsxCompileContext) {
  const { normalizedExpression, parameterIdentifiers, scopeKeys } = analyzeInlineExpression(exp, context)
  const id = createInlineExpressionId(context.inlineExpressionSeed++)
  context.inlineExpressions.push({
    id,
    expression: generate(normalizedExpression, WXML_EXPRESSION_GENERATE_OPTIONS).code,
    scopeKeys,
    parameterNames: {
      context: parameterIdentifiers.context.name,
      scope: parameterIdentifiers.scope.name,
      event: parameterIdentifiers.event.name,
    },
  })
  return {
    id,
    scopeKeys,
  }
}

export function toJsxTagName(
  name: JSXIdentifier | JSXNamespacedName | t.JSXMemberExpression,
  context: JsxCompileContext,
): string {
  if (t.isJSXIdentifier(name)) {
    return name.name
  }
  if (t.isJSXNamespacedName(name)) {
    return `${name.namespace.name}:${name.name.name}`
  }

  context.warnings.push('JSX 成员标签（如 <Foo.Bar />）无法映射为小程序 WXML 组件标签，已生成 dynamic island。')
  return 'block'
}
