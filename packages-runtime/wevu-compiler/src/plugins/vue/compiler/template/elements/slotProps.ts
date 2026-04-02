import type { ElementNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import * as t from '@weapp-vite/ast/babelTypes'
import { parse as babelParse } from '../../../../../utils/babel'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { toWxmlStringLiteral } from './helpers'

const BACKSLASH_RE = /\\/g
const SINGLE_QUOTE_RE = /'/g

export function parseSlotPropsExpression(exp: string, context: TransformContext): Record<string, string> {
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
          context.warnings.push('小程序不支持作用域插槽的剩余解构元素。')
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
          context.warnings.push('小程序不支持作用域插槽的计算属性键。')
          continue
        }
        const value = prop.value
        if (t.isIdentifier(value)) {
          mapping[value.name] = propName
          continue
        }
        if (t.isAssignmentPattern(value) && t.isIdentifier(value.left)) {
          mapping[value.left.name] = propName
          context.warnings.push('不支持作用域插槽参数的默认值，默认值将被忽略。')
          continue
        }
        context.warnings.push('作用域插槽解构仅支持标识符绑定。')
      }
      return mapping
    }
  }
  catch {
    context.warnings.push('作用域插槽参数解析失败，已回退为空参数。')
  }
  return {}
}

export function collectSlotBindingExpression(node: ElementNode, context: TransformContext) {
  let bindObjectExp: string | null = null
  const namedBindings: Array<{ key: string, value: string }> = []

  for (const prop of node.props) {
    if (prop.type === NodeTypes.ATTRIBUTE && prop.name === 'name') {
      continue
    }
    if (prop.type === NodeTypes.DIRECTIVE && prop.name === 'bind') {
      if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION) {
        const rawExpValue = prop.exp?.type === NodeTypes.SIMPLE_EXPRESSION ? prop.exp.content : ''
        if (prop.arg.content === 'name') {
          continue
        }
        if (rawExpValue) {
          namedBindings.push({ key: prop.arg.content, value: normalizeWxmlExpressionWithContext(rawExpValue, context) })
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
    context.warnings.push('作用域插槽参数使用 v-bind 对象时，将忽略额外的命名绑定。')
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
