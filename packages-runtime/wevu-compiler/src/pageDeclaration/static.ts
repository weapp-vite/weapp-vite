import type { ObjectExpression } from '@weapp-vite/ast/babelTypes'
import type { PageDeclarationCall, StaticPageDeclaration, StaticRouteValue } from './types'
import { WEVU_DEFINE_PAGE_MACRO } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { createPageDeclarationError } from './diagnostics'

function unwrapStaticExpression(node: t.Expression): t.Expression {
  if (
    t.isTSAsExpression(node)
    || t.isTSSatisfiesExpression(node)
    || t.isTSNonNullExpression(node)
    || t.isTSTypeAssertion(node)
    || t.isTypeCastExpression(node)
    || t.isParenthesizedExpression(node)
  ) {
    return unwrapStaticExpression(node.expression as t.Expression)
  }
  return node
}

function resolveStaticString(node: t.Expression) {
  const value = unwrapStaticExpression(node)
  if (t.isStringLiteral(value)) {
    return value.value
  }
  if (t.isTemplateLiteral(value) && value.expressions.length === 0) {
    return value.quasis[0]?.value.cooked ?? value.quasis[0]?.value.raw ?? ''
  }
  return undefined
}

function resolveObjectKey(property: t.ObjectProperty) {
  if (property.computed) {
    return undefined
  }
  if (t.isIdentifier(property.key)) {
    return property.key.name
  }
  if (t.isStringLiteral(property.key) || t.isNumericLiteral(property.key)) {
    return String(property.key.value)
  }
  return undefined
}

function defineSafeProperty(target: Record<string, StaticRouteValue>, key: string, value: StaticRouteValue) {
  Object.defineProperty(target, key, {
    configurable: true,
    enumerable: true,
    value,
    writable: true,
  })
}

function resolveStaticRouteValue(pageCall: PageDeclarationCall, node: ObjectExpression): Record<string, StaticRouteValue>
function resolveStaticRouteValue(pageCall: PageDeclarationCall, node: t.Expression): StaticRouteValue
function resolveStaticRouteValue(
  pageCall: PageDeclarationCall,
  node: t.Expression,
): StaticRouteValue {
  const value = unwrapStaticExpression(node)
  if (t.isStringLiteral(value) || t.isBooleanLiteral(value)) {
    return value.value
  }
  if (t.isNullLiteral(value)) {
    return null
  }
  if (t.isNumericLiteral(value) && Number.isFinite(value.value)) {
    return value.value
  }
  if (
    t.isUnaryExpression(value)
    && (value.operator === '-' || value.operator === '+')
    && t.isNumericLiteral(value.argument)
  ) {
    const numberValue = value.operator === '-' ? -value.argument.value : value.argument.value
    if (Number.isFinite(numberValue)) {
      return numberValue
    }
  }
  if (t.isTemplateLiteral(value) && value.expressions.length === 0) {
    return value.quasis[0]?.value.cooked ?? value.quasis[0]?.value.raw ?? ''
  }
  if (t.isArrayExpression(value)) {
    return value.elements.map((element) => {
      if (!element || t.isSpreadElement(element) || !t.isExpression(element)) {
        throw createPageDeclarationError(
          pageCall.block,
          element ?? value,
          `${WEVU_DEFINE_PAGE_MACRO}().meta 只能包含无空项、无展开的有限 JSON 值。`,
        )
      }
      return resolveStaticRouteValue(pageCall, element)
    })
  }
  if (t.isObjectExpression(value)) {
    const result: Record<string, StaticRouteValue> = {}
    for (const property of value.properties) {
      if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
        throw createPageDeclarationError(
          pageCall.block,
          property,
          `${WEVU_DEFINE_PAGE_MACRO}().meta 不支持展开、方法或访问器。`,
        )
      }
      const key = resolveObjectKey(property)
      if (key == null) {
        throw createPageDeclarationError(
          pageCall.block,
          property.key,
          `${WEVU_DEFINE_PAGE_MACRO}().meta 不支持计算或动态属性名。`,
        )
      }
      defineSafeProperty(result, key, resolveStaticRouteValue(pageCall, property.value))
    }
    return result
  }

  throw createPageDeclarationError(
    pageCall.block,
    value,
    `${WEVU_DEFINE_PAGE_MACRO}().meta 只能包含静态有限 JSON 值。`,
  )
}

export function resolvePageDeclaration(
  pageCall: PageDeclarationCall,
): StaticPageDeclaration {
  const call = pageCall.call
  if (call.arguments.length !== 1) {
    throw createPageDeclarationError(
      pageCall.block,
      call,
      `${WEVU_DEFINE_PAGE_MACRO}() 必须且只能接收一个静态对象参数。`,
    )
  }
  const argument = call.arguments[0]!
  if (!t.isExpression(argument) || !t.isObjectExpression(unwrapStaticExpression(argument))) {
    throw createPageDeclarationError(
      pageCall.block,
      argument,
      `${WEVU_DEFINE_PAGE_MACRO}() 必须且只能接收一个静态对象参数。`,
    )
  }

  const object = unwrapStaticExpression(argument) as ObjectExpression
  let name: string | undefined
  let meta: Record<string, StaticRouteValue> | undefined
  const seen = new Set<string>()
  for (const property of object.properties) {
    if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
      throw createPageDeclarationError(
        pageCall.block,
        property,
        `${WEVU_DEFINE_PAGE_MACRO}() 不支持展开、方法或访问器。`,
      )
    }
    const key = resolveObjectKey(property)
    if (key == null) {
      throw createPageDeclarationError(
        pageCall.block,
        property.key,
        `${WEVU_DEFINE_PAGE_MACRO}() 不支持计算或动态属性名。`,
      )
    }
    if (key !== 'name' && key !== 'meta') {
      throw createPageDeclarationError(
        pageCall.block,
        property.key,
        `${WEVU_DEFINE_PAGE_MACRO}() 不支持属性 "${key}"；path 由页面注册位置生成。`,
      )
    }
    if (seen.has(key)) {
      throw createPageDeclarationError(
        pageCall.block,
        property.key,
        `${WEVU_DEFINE_PAGE_MACRO}() 的属性 "${key}" 不能重复。`,
      )
    }
    seen.add(key)

    if (key === 'name') {
      const staticName = resolveStaticString(property.value)
      if (staticName == null || staticName.trim().length === 0) {
        throw createPageDeclarationError(
          pageCall.block,
          property.value,
          `${WEVU_DEFINE_PAGE_MACRO}().name 必须是非空静态字符串。`,
        )
      }
      name = staticName
    }
    else {
      const value = unwrapStaticExpression(property.value)
      if (!t.isObjectExpression(value)) {
        throw createPageDeclarationError(
          pageCall.block,
          property.value,
          `${WEVU_DEFINE_PAGE_MACRO}().meta 必须是静态对象。`,
        )
      }
      meta = resolveStaticRouteValue(pageCall, value)
    }
  }
  if (name == null) {
    throw createPageDeclarationError(
      pageCall.block,
      object,
      `${WEVU_DEFINE_PAGE_MACRO}() 必须声明非空静态 name。`,
    )
  }
  return meta === undefined ? { name } : { name, meta }
}
