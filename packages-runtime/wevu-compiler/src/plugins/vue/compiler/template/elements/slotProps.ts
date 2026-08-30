import type { ElementNode, SourceLocation } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { WEVU_SLOT_FUNCTION_TOKEN } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'

import { parse as babelParse } from '../../../../../utils/babel'
import { warn } from '../diagnostics'
import { normalizeWxmlExpressionWithContext, registerInlineExpression } from '../expression'
import { getBindDirectiveExpression, toWxmlStringLiteral } from './helpers'

const BACKSLASH_RE = /\\/g
const SINGLE_QUOTE_RE = /'/g

function isFunctionBindingExpression(exp: string) {
  try {
    const ast = babelParse(`(${exp})`, { sourceType: 'module', plugins: ['typescript'] })
    const stmt = ast.program.body[0]
    const expression = stmt && 'expression' in stmt ? (stmt as any).expression as t.Expression : undefined
    return t.isArrowFunctionExpression(expression) || t.isFunctionExpression(expression)
  }
  catch {
    return false
  }
}

function createSlotFunctionBinding(exp: string, context: TransformContext, location?: SourceLocation) {
  if (!isFunctionBindingExpression(exp)) {
    return null
  }
  const inline = registerInlineExpression(`(${exp})(...$event)`, context)
  if (!inline) {
    warn(context, '作用域插槽函数参数编译失败。', location, 'expression')
    return null
  }
  const scopeBindings = `[${inline.scopeBindings.join(',')}]`
  const indexBindings = `[${inline.indexBindings.join(',')}]`
  return `[${toWxmlStringLiteral(WEVU_SLOT_FUNCTION_TOKEN)},${toWxmlStringLiteral(inline.id)},${scopeBindings},${indexBindings}]`
}

export function parseSlotPropsExpression(
  exp: string,
  context: TransformContext,
  location?: SourceLocation,
): Record<string, string> {
  const trimmed = exp.trim()
  if (!trimmed) {
    return {}
  }
  try {
    const ast = babelParse(`(${trimmed}) => {}`, { sourceType: 'module', plugins: ['typescript'] })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return {}
    }
    const expression = (stmt as any).expression as t.Expression
    if (!t.isArrowFunctionExpression(expression)) {
      return {}
    }
    const param = expression.params[0]
    if (!param) {
      return {}
    }
    if (t.isIdentifier(param)) {
      return { [param.name]: '' }
    }
    if (t.isObjectPattern(param)) {
      const mapping: Record<string, string> = {}
      for (const prop of param.properties) {
        if (t.isRestElement(prop)) {
          warn(context, '小程序不支持作用域插槽的剩余解构元素。', location)
          continue
        }
        if (!t.isObjectProperty(prop)) {
          continue
        }
        const key = prop.key
        const propName = t.isIdentifier(key)
          ? key.name
          : t.isStringLiteral(key)
            ? key.value
            : undefined
        if (!propName) {
          warn(context, '小程序不支持作用域插槽的计算属性键。', location)
          continue
        }
        const value = prop.value
        if (t.isIdentifier(value)) {
          mapping[value.name] = propName
          continue
        }
        if (t.isAssignmentPattern(value) && t.isIdentifier(value.left)) {
          mapping[value.left.name] = propName
          warn(context, '不支持作用域插槽参数的默认值，默认值将被忽略。', location)
          continue
        }
        warn(context, '作用域插槽解构仅支持标识符绑定。', location)
      }
      return mapping
    }
  }
  catch {
    warn(context, '作用域插槽参数解析失败，已回退为空参数。', location, 'expression')
  }
  return {}
}

export function collectSlotBindingExpression(node: ElementNode, context: TransformContext) {
  let bindObjectExp: string | null = null
  const namedBindings: Array<{ key: string, value: string }> = []
  const hasForDirective = node.props.some(prop => prop.type === NodeTypes.DIRECTIVE && prop.name === 'for')

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      continue
    }
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind') {
      if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
        const rawExpValue = getBindDirectiveExpression(prop)
        if (prop.arg.content === 'name' || (hasForDirective && prop.arg.content === 'key')) {
          continue
        }
        if (rawExpValue) {
          namedBindings.push({
            key: prop.arg.content,
            value: createSlotFunctionBinding(rawExpValue, context, prop.loc)
              ?? normalizeWxmlExpressionWithContext(rawExpValue, context),
          })
        }
        continue
      }
      if (prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION) {
        bindObjectExp = normalizeWxmlExpressionWithContext(prop.exp.content, context)
        continue
      }
    }
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name !== 'name') {
      const literal = prop.value?.type === NodeTypes.TEXT ? prop.value.content : ''
      if (literal) {
        namedBindings.push({ key: prop.name, value: `'${literal.replace(BACKSLASH_RE, '\\\\').replace(SINGLE_QUOTE_RE, '\\\'')}'` })
      }
    }
  }

  if (bindObjectExp && namedBindings.length) {
    warn(context, '作用域插槽参数使用 v-bind 对象时，将忽略额外的命名绑定。', node.loc)
    namedBindings.length = 0
  }

  if (bindObjectExp) {
    return bindObjectExp
  }

  if (!namedBindings.length) {
    return null
  }

  return `[${namedBindings.map(entry => `${toWxmlStringLiteral(entry.key)},${entry.value}`).join(',')}]`
}
