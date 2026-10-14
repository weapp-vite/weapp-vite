import type { TemplateChildNode } from '@vue/compiler-core'
import { baseParse, NodeTypes } from '@vue/compiler-core'
import * as t from '@weapp-vite/ast/babelTypes'
import { isBuiltinComponent } from '../../../../../auto-import-components/builtin'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse } from '../../../../../utils/babel'
import { parseForExpression } from '../../../compiler/template/elements/forExpression'

export interface TemplateFacts {
  required: boolean
  tags: Set<string>
  expressions: string
}

/** 模板表达式保留循环局部绑定，交给脚本的同一套词法绑定分析。 */
export function analyzeTemplate(content: string): TemplateFacts {
  const facts: TemplateFacts = { required: false, tags: new Set(), expressions: '' }
  const expression = (source: string, event = false) => {
    if (!source.trim()) {
      return ''
    }
    try {
      const ast = parse(`(${source})`, BABEL_TS_MODULE_PARSER_OPTIONS)
      const statement = ast.program.body[0]
      const handler = t.isExpressionStatement(statement) && (t.isIdentifier(statement.expression) || t.isMemberExpression(statement.expression) || t.isOptionalMemberExpression(statement.expression))
      return event && handler ? `;(${source})();` : `;(${source});`
    }
    catch {
      if (event) {
        return `;(() => { ${source}\n})();`
      }
      facts.required = true
      return ''
    }
  }
  try {
    const ast = baseParse(content, { onError: () => {
      facts.required = true
    } })
    const visit = (node: TemplateChildNode): string => {
      if (node.type === NodeTypes.INTERPOLATION && node.content.type === NodeTypes.SIMPLE_EXPRESSION) {
        return expression(node.content.content)
      }
      if (node.type !== NodeTypes.ELEMENT) {
        return ''
      }
      if (node.tag === 'slot' || node.tag === 'component' || (node.tag === 'template' && node.props.some(prop => prop.type === NodeTypes.ATTRIBUTE && (prop.name === 'is' || prop.name === 'src')))) {
        facts.required = true
      }
      else if (!isBuiltinComponent(node.tag) && node.tag !== 'template' && node.tag !== 'block') {
        facts.tags.add(node.tag)
      }
      let code = ''
      let list = ''
      let aliases: string[] | undefined
      for (const prop of node.props) {
        if (prop.type !== NodeTypes.DIRECTIVE) {
          continue
        }
        if (prop.name === 'slot' || !['bind', 'on', 'if', 'else', 'else-if', 'for', 'show', 'model', 'text', 'once', 'memo', 'cloak', 'pre'].includes(prop.name)) {
          facts.required = true
        }
        if (prop.arg?.type === NodeTypes.SIMPLE_EXPRESSION && !prop.arg.isStatic) {
          code += expression(prop.arg.content)
        }
        if (prop.exp?.type !== NodeTypes.SIMPLE_EXPRESSION) {
          continue
        }
        if (prop.name === 'for') {
          const loop = parseForExpression(prop.exp.content)
          if (loop.error || loop.itemPatternError || !loop.listExp) {
            facts.required = true
          }
          if (loop.listExp) {
            list += expression(loop.listExp)
          }
          aliases = [...new Set([
            ...Object.keys(loop.itemAliases ?? {}),
            loop.item,
            loop.index,
            loop.key,
          ].filter((name): name is string => Boolean(name)))]
        }
        else if (prop.name !== 'slot') {
          const body = expression(prop.exp.content, prop.name === 'on')
          code += prop.name === 'on' ? `;(($event) => { ${body} });` : body
        }
      }
      code += node.children.map(visit).join('\n')
      return aliases ? `${list};((${aliases.join(',')}) => { ${code}\n});` : code
    }
    facts.expressions = ast.children.map(visit).join('\n')
  }
  catch {
    facts.required = true
  }
  return facts
}
