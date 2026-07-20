import type {
  DirectiveNode,
  ElementNode,
  RootNode,
  SimpleExpressionNode,
  TemplateChildNode,
} from '@vue/compiler-core'
import type { QuickAppComponentImport } from './types'
import { generate } from '@babel/generator'
import { parseExpression } from '@babel/parser'
import traverse from '@babel/traverse'
import * as t from '@babel/types'
import { baseParse, NodeTypes } from '@vue/compiler-dom'

type AliasMap = Map<string, string>

function escapeAttribute(value: string) {
  return value.replaceAll('&', '&amp;').replaceAll('"', '&quot;')
}

function rewriteExpression(expression: string, aliases: AliasMap) {
  if (aliases.size === 0) {
    return expression
  }
  const ast = t.file(t.program([t.expressionStatement(parseExpression(expression))]))
  traverse(ast, {
    Identifier(path) {
      const replacement = aliases.get(path.node.name)
      if (replacement && path.isReferencedIdentifier()) {
        path.replaceWith(t.identifier(replacement))
      }
    },
  })
  const statement = ast.program.body[0]
  return t.isExpressionStatement(statement) ? generate(statement.expression).code : expression
}

function getDirectiveExpression(directive: DirectiveNode, aliases: AliasMap) {
  return directive.exp && directive.exp.type === NodeTypes.SIMPLE_EXPRESSION
    ? rewriteExpression(directive.exp.content, aliases)
    : ''
}

function getDirectiveArgument(directive: DirectiveNode) {
  return directive.arg && directive.arg.type === NodeTypes.SIMPLE_EXPRESSION
    ? directive.arg.content
    : ''
}

function parseForDirective(directive: DirectiveNode, aliases: AliasMap) {
  const expression = directive.exp?.type === NodeTypes.SIMPLE_EXPRESSION
    ? directive.exp.content
    : ''
  const normalized = expression.trim()
  const separator = /\s+(?:in|of)\s+/.exec(normalized)
  if (!separator || separator.index === 0) {
    throw new Error(`QuickApp Vue 编译暂不支持该 v-for 表达式：${expression}`)
  }
  const aliasExpression = normalized.slice(0, separator.index).trim()
  const sourceExpression = normalized.slice(separator.index + separator[0].length).trim()
  if (!sourceExpression) {
    throw new Error(`QuickApp Vue 编译暂不支持该 v-for 表达式：${expression}`)
  }
  const unwrappedAliases = aliasExpression.startsWith('(') && aliasExpression.endsWith(')')
    ? aliasExpression.slice(1, -1)
    : aliasExpression
  const [item, index, ...extraAliases] = unwrappedAliases.split(',').map(alias => alias.trim())
  if (!item || !t.isValidIdentifier(item) || (index && !t.isValidIdentifier(index)) || extraAliases.length > 0) {
    throw new Error(`QuickApp Vue 编译暂不支持该 v-for 表达式：${expression}`)
  }
  const source = rewriteExpression(sourceExpression, aliases)
  const childAliases = new Map(aliases)
  childAliases.set(item, '$item')
  if (index) {
    childAliases.set(index, '$idx')
  }
  return { childAliases, source }
}

function renderDirective(directive: DirectiveNode, aliases: AliasMap) {
  const expression = getDirectiveExpression(directive, aliases)
  if (directive.name === 'bind') {
    const argument = getDirectiveArgument(directive)
    if (!argument) {
      throw new Error('QuickApp Vue 编译不支持无参数 v-bind。')
    }
    return `${argument}="{{${escapeAttribute(expression)}}}"`
  }
  if (directive.name === 'on') {
    const event = getDirectiveArgument(directive).toLowerCase()
    if (!event || directive.modifiers.length > 0) {
      throw new Error('QuickApp Vue 编译暂不支持动态事件名或事件修饰符。')
    }
    return `on${event}="${escapeAttribute(expression)}"`
  }
  if (directive.name === 'if') {
    return `if="{{${escapeAttribute(expression)}}}"`
  }
  if (directive.name === 'else-if') {
    return `elif="{{${escapeAttribute(expression)}}}"`
  }
  if (directive.name === 'else') {
    return 'else'
  }
  if (directive.name === 'show') {
    return `show="{{${escapeAttribute(expression)}}}"`
  }
  if (directive.name === 'for') {
    return ''
  }
  if (directive.name === 'model') {
    throw new Error('QuickApp Vue 编译暂不支持 v-model，请显式使用 value 与事件。')
  }
  throw new Error(`QuickApp Vue 编译暂不支持 v-${directive.name}。`)
}

function renderElement(node: ElementNode, aliases: AliasMap): string {
  const forDirective = node.props.find((prop): prop is DirectiveNode => prop.type === NodeTypes.DIRECTIVE && prop.name === 'for')
  const forResult = forDirective ? parseForDirective(forDirective, aliases) : undefined
  const elementAliases = forResult?.childAliases ?? aliases
  const attributes = node.props
    .map((prop) => {
      if (prop.type === NodeTypes.ATTRIBUTE) {
        return prop.value ? `${prop.name}="${escapeAttribute(prop.value.content)}"` : prop.name
      }
      return renderDirective(prop, elementAliases)
    })
    .filter(Boolean)
  if (forResult) {
    attributes.push(`for="{{${escapeAttribute(forResult.source)}}}"`)
  }
  const open = attributes.length > 0 ? `<${node.tag} ${attributes.join(' ')}>` : `<${node.tag}>`
  // renderNode 与 renderElement 共同递归遍历模板树。
  // eslint-disable-next-line ts/no-use-before-define
  return `${open}${node.children.map(child => renderNode(child, elementAliases)).join('')}</${node.tag}>`
}

function renderNode(node: TemplateChildNode, aliases: AliasMap): string {
  if (node.type === NodeTypes.ELEMENT) {
    return renderElement(node, aliases)
  }
  if (node.type === NodeTypes.TEXT) {
    return node.content
  }
  if (node.type === NodeTypes.INTERPOLATION) {
    const content = (node.content as SimpleExpressionNode).content
    return `{{${rewriteExpression(content, aliases)}}}`
  }
  if (node.type === NodeTypes.COMMENT) {
    return `<!--${node.content}-->`
  }
  throw new Error(`QuickApp Vue 模板包含暂不支持的节点类型：${node.type}`)
}

function renderRoot(root: RootNode) {
  return root.children.map(child => renderNode(child, new Map())).join('')
}

export function compileQuickAppVueTemplate(template: string, components: QuickAppComponentImport[]) {
  const imports = components
    .map(component => `<import name="${component.name}" src="${component.source}"></import>`)
    .join('\n')
  const content = renderRoot(baseParse(template))
  return { content, imports }
}
