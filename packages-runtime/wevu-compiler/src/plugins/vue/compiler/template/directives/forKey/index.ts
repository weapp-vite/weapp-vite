import type { DirectiveNode } from '@vue/compiler-core'
import type { ForParseResult, TransformContext } from '../../types'
import { getBindDirectiveExpression } from '../../elements/helpers'
import { normalizeJsExpressionWithContext } from '../../expression'
import { createForKeyProjectionExpression } from './projection'

const SIMPLE_IDENTIFIER_RE = /^[A-Z_$][\w$]*$/i
const SIMPLE_MEMBER_PATH_RE = /^[A-Z_$][\w$]*(?:\.[A-Z_$][\w$]*)*$/i
const RUNTIME_BINDING_REF_RE = /^__wv_bind_\d+(?:\[[A-Z_$][\w$]*\])*$/i

export interface ForKeyProjection {
  keyAttr: string
  listExp: string
}

export function resolveNativeForKeyValue(exp: string, forInfo: ForParseResult | undefined, keyThisValue: string) {
  const trimmed = exp.trim()
  if (!forInfo) {
    return null
  }
  if ((forInfo.item && trimmed === forInfo.item) || (forInfo.key && trimmed === forInfo.key)) {
    return keyThisValue
  }
  if (forInfo.item && trimmed.startsWith(`${forInfo.item}.`)) {
    const remainder = trimmed.slice(forInfo.item.length + 1)
    if (SIMPLE_MEMBER_PATH_RE.test(remainder) && !remainder.includes('.')) {
      return remainder
    }
    return null
  }
  if (SIMPLE_IDENTIFIER_RE.test(trimmed)) {
    return trimmed
  }
  return null
}

export function createForKeyProjection(
  node: DirectiveNode,
  forInfo: ForParseResult,
  context: TransformContext,
): ForKeyProjection | null {
  const rawKeyExp = getBindDirectiveExpression(node).trim()
  if (
    !rawKeyExp
    || !forInfo.listExpAst
    || resolveNativeForKeyValue(rawKeyExp, forInfo, context.platform.keyThisValue)
  ) {
    return null
  }
  const listExp = forInfo.listExp?.trim() ?? ''
  const projectionSourceAst = RUNTIME_BINDING_REF_RE.test(listExp)
    ? normalizeJsExpressionWithContext(listExp, context, {
        hint: 'v-for :key 数据源',
        runtimePropAccess: 'helper',
        unrefMemberAccess: true,
      })
    : forInfo.listExpAst
  if (!projectionSourceAst) {
    return null
  }

  const keyExpAst = normalizeJsExpressionWithContext(rawKeyExp, context, {
    hint: 'v-for :key',
    runtimePropAccess: 'helper',
    unrefMemberAccess: true,
  })
  if (!keyExpAst) {
    return null
  }

  const bindingSeed = context.classStyleBindings.filter(binding => binding.type === 'bind').length
  const bindingName = `__wv_bind_${bindingSeed}`
  const keyField = `__wv_key_${bindingSeed}`
  const outerForStack = context.forStack.slice(0, -1).map(info => ({ ...info }))
  context.classStyleBindings.push({
    name: bindingName,
    type: 'bind',
    exp: `v-for :key ${rawKeyExp}`,
    expAst: createForKeyProjectionExpression(
      projectionSourceAst,
      keyExpAst,
      rawKeyExp,
      keyField,
      forInfo,
      bindingSeed,
    ),
    forStack: outerForStack,
  })

  const indexAccess = outerForStack
    .map(info => `[${info.index ?? 'index'}]`)
    .join('')
  return {
    keyAttr: context.platform.keyAttr(keyField),
    listExp: `${bindingName}${indexAccess}`,
  }
}
