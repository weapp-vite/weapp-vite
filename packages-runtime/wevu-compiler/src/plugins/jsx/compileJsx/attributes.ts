import type {
  Expression,
  JSXAttribute,
  JSXElement,
  JSXSpreadAttribute,
} from '@weapp-vite/ast/babelTypes'
import type { JsxCompileContext } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import {
  escapeAttr,
  normalizeInterpolationExpression,
  registerInlineExpression,
  renderMustache,
  unwrapTsExpression,
} from './ast'

const ON_EVENT_RE = /^on[A-Z]/
const CATCH_EVENT_RE = /^catch[A-Z]/
const CAPTURE_BIND_EVENT_RE = /^captureBind[A-Z]/
const CAPTURE_CATCH_EVENT_RE = /^captureCatch[A-Z]/
const MUT_BIND_EVENT_RE = /^mutBind[A-Z]/

function isEventBinding(name: string) {
  return ON_EVENT_RE.test(name)
    || CATCH_EVENT_RE.test(name)
    || CAPTURE_BIND_EVENT_RE.test(name)
    || CAPTURE_CATCH_EVENT_RE.test(name)
    || MUT_BIND_EVENT_RE.test(name)
}

const LEADING_UPPER_RE = /^[A-Z]/
const UPPER_CHAR_RE = /[A-Z]/g

function lowerEventName(name: string) {
  if (!name) {
    return name
  }
  return name
    .replace(LEADING_UPPER_RE, s => s.toLowerCase())
    .replace(UPPER_CHAR_RE, s => s.toLowerCase())
}

function toEventBindingName(rawName: string, context: JsxCompileContext) {
  const resolveEvent = (name: string) => context.platform.mapEventName(lowerEventName(name))

  if (CAPTURE_BIND_EVENT_RE.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('captureBind'.length))
    return context.platform.eventBindingAttr(`capture-bind:${eventName}`)
  }
  if (CAPTURE_CATCH_EVENT_RE.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('captureCatch'.length))
    return context.platform.eventBindingAttr(`capture-catch:${eventName}`)
  }
  if (MUT_BIND_EVENT_RE.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('mutBind'.length))
    return context.platform.eventBindingAttr(`mut-bind:${eventName}`)
  }
  if (CATCH_EVENT_RE.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('catch'.length))
    return context.platform.eventBindingAttr(`catch:${eventName}`)
  }

  const eventName = resolveEvent(rawName.slice('on'.length))
  return context.platform.eventBindingAttr(`bind:${eventName}`)
}

function readJsxAttributeExpression(value: JSXAttribute['value']) {
  if (!value) {
    return t.booleanLiteral(true) as Expression
  }
  if (t.isStringLiteral(value)) {
    return value as Expression
  }
  if (!t.isJSXExpressionContainer(value)) {
    return null
  }
  if (t.isJSXEmptyExpression(value.expression)) {
    return null
  }
  return unwrapTsExpression(value.expression as Expression)
}

export function extractJsxKeyExpression(node: JSXElement): string | null {
  for (const attr of node.openingElement.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
      continue
    }
    if (attr.name.name !== 'key') {
      continue
    }
    const exp = readJsxAttributeExpression(attr.value)
    if (!exp) {
      return null
    }
    if (t.isStringLiteral(exp)) {
      return exp.value
    }
    return normalizeInterpolationExpression(exp)
  }
  return null
}

function compileEventAttribute(
  name: string,
  value: JSXAttribute['value'],
  context: JsxCompileContext,
): string[] {
  const bindAttr = toEventBindingName(name, context)
  const exp = readJsxAttributeExpression(value)
  if (!exp) {
    return []
  }

  if (t.isStringLiteral(exp) && exp.value) {
    return [`${bindAttr}="${escapeAttr(exp.value)}"`]
  }

  if (t.isIdentifier(exp)) {
    return [`${bindAttr}="${escapeAttr(exp.name)}"`]
  }

  if (
    t.isMemberExpression(exp)
    && !exp.computed
    && t.isThisExpression(exp.object)
    && t.isIdentifier(exp.property)
  ) {
    return [`${bindAttr}="${escapeAttr(exp.property.name)}"`]
  }

  const inline = registerInlineExpression(exp, context)
  const attrs = [`data-wv-inline-id="${inline.id}"`, `${bindAttr}="__weapp_vite_inline"`]
  inline.scopeKeys.forEach((scopeKey, index) => {
    attrs.push(`data-wv-s${index}="${renderMustache(scopeKey, context)}"`)
  })
  return attrs
}

function compileNormalAttribute(
  name: string,
  value: JSXAttribute['value'],
  context: JsxCompileContext,
): string | null {
  const normalizedName = name === 'className' ? 'class' : name
  const exp = readJsxAttributeExpression(value)
  if (!exp) {
    return null
  }

  if (t.isStringLiteral(exp)) {
    return `${normalizedName}="${escapeAttr(exp.value)}"`
  }

  if (t.isBooleanLiteral(exp)) {
    return `${normalizedName}="${renderMustache(String(exp.value), context)}"`
  }

  const normalizedExp = normalizeInterpolationExpression(exp)
  return `${normalizedName}="${renderMustache(normalizedExp, context)}"`
}

export function compileJsxAttributes(
  attributes: Array<JSXAttribute | JSXSpreadAttribute>,
  context: JsxCompileContext,
): string[] {
  const output: string[] = []
  for (const attr of attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      context.warnings.push('暂不支持 JSX spread attributes，已忽略。')
      continue
    }
    if (!t.isJSXIdentifier(attr.name)) {
      context.warnings.push('暂不支持 JSX 动态属性名，已忽略。')
      continue
    }

    const name = attr.name.name
    if (name === 'key') {
      continue
    }

    if (isEventBinding(name)) {
      output.push(...compileEventAttribute(name, attr.value, context))
      continue
    }

    const normalAttr = compileNormalAttribute(name, attr.value, context)
    if (normalAttr) {
      output.push(normalAttr)
    }
  }
  return output
}
