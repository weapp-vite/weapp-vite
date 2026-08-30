import type {
  Expression,
  JSXAttribute,
  JSXElement,
  JSXSpreadAttribute,
} from '@weapp-vite/ast/babelTypes'
import type { JsxCompileContext } from './types'
import { WEVU_INLINE_HANDLER } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import {
  INLINE_DATASET_KEY,
  normalizeEventDatasetSuffix,
} from '../../../inlineDataset'
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
const UPPERCASE_STYLE_RE = /[A-Z]/g

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

function resolveMappedEventName(rawName: string, context: JsxCompileContext) {
  const resolveEvent = (name: string) => context.platform.mapEventName(lowerEventName(name))

  if (CAPTURE_BIND_EVENT_RE.test(rawName)) {
    return resolveEvent(rawName.slice('captureBind'.length))
  }
  if (CAPTURE_CATCH_EVENT_RE.test(rawName)) {
    return resolveEvent(rawName.slice('captureCatch'.length))
  }
  if (MUT_BIND_EVENT_RE.test(rawName)) {
    return resolveEvent(rawName.slice('mutBind'.length))
  }
  if (CATCH_EVENT_RE.test(rawName)) {
    return resolveEvent(rawName.slice('catch'.length))
  }

  return resolveEvent(rawName.slice('on'.length))
}

function toEventBindingName(rawName: string, context: JsxCompileContext) {
  const eventName = resolveMappedEventName(rawName, context)

  if (CAPTURE_BIND_EVENT_RE.test(rawName)) {
    return context.platform.eventBindingAttr(`capture-bind:${eventName}`)
  }
  if (CAPTURE_CATCH_EVENT_RE.test(rawName)) {
    return context.platform.eventBindingAttr(`capture-catch:${eventName}`)
  }
  if (MUT_BIND_EVENT_RE.test(rawName)) {
    return context.platform.eventBindingAttr(`mut-bind:${eventName}`)
  }
  if (CATCH_EVENT_RE.test(rawName)) {
    return context.platform.eventBindingAttr(`catch:${eventName}`)
  }

  return context.platform.eventBindingAttr(`bind:${eventName}`)
}

export function readJsxAttributeExpression(value: JSXAttribute['value']) {
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
  const eventName = resolveMappedEventName(name, context)
  const eventSuffix = normalizeEventDatasetSuffix(eventName)
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
  const attrs = [`data-${INLINE_DATASET_KEY}-${eventSuffix}="${inline.id}"`, `${bindAttr}="${WEVU_INLINE_HANDLER}"`]
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

  if (normalizedName === 'class') {
    // eslint-disable-next-line ts/no-use-before-define
    const value = resolveStaticClass(exp)
    if (value != null) {
      return `class="${escapeAttr(value)}"`
    }
  }
  if (normalizedName === 'style') {
    // eslint-disable-next-line ts/no-use-before-define
    const value = resolveStaticStyle(exp)
    if (value != null) {
      return `style="${escapeAttr(value)}"`
    }
  }

  const normalizedExp = normalizeInterpolationExpression(exp)
  return `${normalizedName}="${renderMustache(normalizedExp, context)}"`
}

function compileNamedAttribute(
  name: string,
  value: JSXAttribute['value'],
  context: JsxCompileContext,
): string[] {
  if (name === 'key') {
    return []
  }
  if (name === 'v-html') {
    context.warnings.push('小程序不支持 JSX v-html，请使用 rich-text 组件替代。')
    return []
  }
  if (name === 'v-if' || name === 'v-show' || name === 'v-text' || name === 'v-for') {
    return []
  }
  if (name === 'v-slots' || name === 'v-model' || name === 'v-models') {
    context.warnings.push(`JSX ${name} 需要 Wevu runtime 语义，已生成确定性诊断。`)
    return []
  }
  if (name.startsWith('v-')) {
    context.warnings.push(`小程序不支持 JSX 自定义指令 ${name}，已移除该指令。`)
    return []
  }
  if (name === 'innerHTML' || name.startsWith('domProps')) {
    context.warnings.push(`小程序不支持 JSX DOM property ${name}，已移除该属性。`)
    return []
  }
  if (isEventBinding(name)) {
    return compileEventAttribute(name, value, context)
  }
  const normalAttr = compileNormalAttribute(name, value, context)
  return normalAttr ? [normalAttr] : []
}

export function compileJsxAttributes(
  attributes: Array<JSXAttribute | JSXSpreadAttribute>,
  context: JsxCompileContext,
): string[] {
  const output: string[] = []
  for (const attr of attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      const argument = unwrapTsExpression(attr.argument as Expression)
      if (t.isObjectExpression(argument)) {
        for (const property of argument.properties) {
          if (t.isObjectProperty(property) && !property.computed && (t.isIdentifier(property.key) || t.isStringLiteral(property.key))) {
            const value = property.value
            if (t.isExpression(value)) {
              const name = t.isIdentifier(property.key) ? property.key.name : property.key.value
              output.push(...compileNamedAttribute(name, t.jsxExpressionContainer(value), context))
            }
          }
          else {
            context.warnings.push('JSX spread attributes 包含无法静态展开的属性，已保留为 dynamic island。')
          }
        }
      }
      else {
        context.warnings.push('动态 JSX spread attributes 无法映射为静态 WXML，已生成确定性诊断。')
      }
      continue
    }
    if (t.isJSXNamespacedName(attr.name)) {
      const namespace = attr.name.namespace.name
      const name = attr.name.name.name
      if (namespace.startsWith('v-')) {
        context.warnings.push(`小程序不支持 JSX 自定义指令 ${namespace}:${name}，已移除该指令。`)
      }
      else {
        context.warnings.push(`小程序不支持 JSX 命名属性 ${namespace}:${name}，已移除该属性。`)
      }
      continue
    }
    if (!t.isJSXIdentifier(attr.name)) {
      context.warnings.push('小程序不支持 JSX 动态属性名，已移除该属性。')
      continue
    }

    const name = attr.name.name
    output.push(...compileNamedAttribute(name, attr.value, context))
  }
  return output
}

function staticObjectKey(node: t.ObjectProperty['key']) {
  if (t.isIdentifier(node)) {
    return node.name
  }
  if (t.isStringLiteral(node)) {
    return node.value
  }
  return undefined
}

function resolveStaticClass(exp: Expression): string | undefined {
  if (t.isStringLiteral(exp) || t.isNumericLiteral(exp)) {
    return String(exp.value)
  }
  if (t.isArrayExpression(exp)) {
    const values = exp.elements.map((element) => {
      if (!element || !t.isExpression(element)) {
        return ''
      }
      return resolveStaticClass(element)
    })
    return values.some(value => value == null) ? undefined : values.filter(Boolean).join(' ')
  }
  if (t.isObjectExpression(exp)) {
    const values: string[] = []
    for (const property of exp.properties) {
      if (!t.isObjectProperty(property) || property.computed || !t.isBooleanLiteral(property.value)) {
        return undefined
      }
      const key = staticObjectKey(property.key)
      if (key == null) {
        return undefined
      }
      if (property.value.value) {
        values.push(key)
      }
    }
    return values.join(' ')
  }
  return undefined
}

function resolveStaticStyle(exp: Expression): string | undefined {
  if (t.isStringLiteral(exp)) {
    return exp.value
  }
  if (t.isArrayExpression(exp)) {
    const values = exp.elements.map((element) => {
      if (!element || !t.isExpression(element)) {
        return ''
      }
      return resolveStaticStyle(element)
    })
    return values.some(value => value == null) ? undefined : values.filter(Boolean).join(';')
  }
  if (!t.isObjectExpression(exp)) {
    return undefined
  }
  const values: string[] = []
  for (const property of exp.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      return undefined
    }
    const key = staticObjectKey(property.key)?.replace(UPPERCASE_STYLE_RE, char => `-${char.toLowerCase()}`)
    if (!key || (!t.isStringLiteral(property.value) && !t.isNumericLiteral(property.value))) {
      return undefined
    }
    values.push(`${key}:${property.value.value}`)
  }
  return values.join(';')
}

export function isStaticClassStyleExpression(exp: Expression) {
  return resolveStaticClass(exp) != null || resolveStaticStyle(exp) != null
}
