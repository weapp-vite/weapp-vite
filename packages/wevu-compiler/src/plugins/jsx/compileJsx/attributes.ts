import type {
  Expression,
  JSXAttribute,
  JSXElement,
  JSXSpreadAttribute,
} from '@babel/types'
import type { JsxCompileContext } from './types'
import * as t from '@babel/types'
import {
  escapeAttr,
  normalizeInterpolationExpression,
  registerInlineExpression,
  renderMustache,
  unwrapTsExpression,
} from './ast'

function isEventBinding(name: string) {
  return /^on[A-Z]/.test(name)
    || /^catch[A-Z]/.test(name)
    || /^captureBind[A-Z]/.test(name)
    || /^captureCatch[A-Z]/.test(name)
    || /^mutBind[A-Z]/.test(name)
}

function lowerEventName(name: string) {
  if (!name) {
    return name
  }
  return name
    .replace(/^[A-Z]/, s => s.toLowerCase())
    .replace(/[A-Z]/g, s => s.toLowerCase())
}

function toEventBindingName(rawName: string, context: JsxCompileContext) {
  const resolveEvent = (name: string) => context.platform.mapEventName(lowerEventName(name))

  if (/^captureBind[A-Z]/.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('captureBind'.length))
    return context.platform.eventBindingAttr(`capture-bind:${eventName}`)
  }
  if (/^captureCatch[A-Z]/.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('captureCatch'.length))
    return context.platform.eventBindingAttr(`capture-catch:${eventName}`)
  }
  if (/^mutBind[A-Z]/.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('mutBind'.length))
    return context.platform.eventBindingAttr(`mut-bind:${eventName}`)
  }
  if (/^catch[A-Z]/.test(rawName)) {
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
