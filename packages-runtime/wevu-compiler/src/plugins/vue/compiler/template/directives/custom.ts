import type { DirectiveNode, SourceLocation } from '@vue/compiler-core'
import type { TransformContext } from '../types'
import { NodeTypes } from '@vue/compiler-core'

import { recordBindingExpression } from '../bindingManifest'
import { warn } from '../diagnostics'
import { normalizeWxmlExpressionWithContext } from '../expression'
import { renderMustache } from '../mustache'

const IDENTIFIER_RE = /^[a-z_$][\w$]*$/i

export function transformCustomDirective(
  name: string,
  exp: DirectiveNode['exp'],
  arg: DirectiveNode['arg'],
  context: TransformContext,
  location: SourceLocation,
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
    recordBindingExpression(context, {
      kind: 'attribute',
      expression: exp.content,
      sourceLocation: exp.loc,
    })
    const expValue = normalizeWxmlExpressionWithContext(exp.content, context)
    if (IDENTIFIER_RE.test(expValue)) {
      return `${dataAttrName}="${renderMustache(expValue, context)}"`
    }
    return `${dataAttrName}="${renderMustache(expValue, context)}"`
  }

  if (arg && arg.type === NodeTypes.SIMPLE_EXPRESSION) {
    const argValue = arg.content
    return `${dataAttrName}="${argValue}"`
  }

  warn(context, `自定义指令 v-${name} 可能需要运行时支持。已生成 data 属性：${dataAttrName}`, location)
  return dataAttrName
}
