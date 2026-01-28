import type { DirectiveNode } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'
import { normalizeWxmlExpressionWithContext } from '../expression'

export function transformCustomDirective(
  name: string,
  exp: DirectiveNode['exp'],
  arg: DirectiveNode['arg'],
  context: TransformContext,
): string | null {
  const builtInDirectives = new Set([
    'bind',
    'on',
    'model',
    'show',
    'html',
    'text',
    'if',
    'else-if',
    'else',
    'for',
    'slot',
    'cloak',
    'once',
  ])

  if (builtInDirectives.has(name)) {
    return null
  }

  const dataAttrName = `data-v-${name}`

  if (exp && exp.type === NodeTypes.SIMPLE_EXPRESSION) {
    const expValue = normalizeWxmlExpressionWithContext(exp.content, context)
    if (/^[a-z_$][\w$]*$/i.test(expValue)) {
      return `${dataAttrName}="{{${expValue}}}"`
    }
    return `${dataAttrName}="{{${expValue}}}"`
  }

  if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    const argValue = arg.content
    return `${dataAttrName}="${argValue}"`
  }

  context.warnings.push(
    `自定义指令 v-${name} 可能需要运行时支持。已生成 data 属性：${dataAttrName}`,
  )
  return dataAttrName
}
