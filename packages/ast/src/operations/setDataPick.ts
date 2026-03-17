import type * as t from '@babel/types'
import type { AstEngineName } from '../types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse, traverse } from '../babel'
import { parseJsLikeWithEngine } from '../engine'

const TEMPLATE_MUSTACHE_RE = /\{\{([\s\S]*?)\}\}/g
const WX_FOR_TAG_RE = /<[^>]*\bwx:for\s*=\s*(?:"[^"]*"|'[^']*')[^>]*>/g
const WX_FOR_ITEM_RE = /\bwx:for-item\s*=\s*(?:"([^"]+)"|'([^']+)')/
const WX_FOR_INDEX_RE = /\bwx:for-index\s*=\s*(?:"([^"]+)"|'([^']+)')/

const JS_GLOBAL_IDENTIFIERS = new Set([
  'undefined',
  'NaN',
  'Infinity',
  'globalThis',
  'Math',
  'Number',
  'String',
  'Boolean',
  'Object',
  'Array',
  'Date',
  'JSON',
  'RegExp',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'parseInt',
  'parseFloat',
  'isNaN',
  'isFinite',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
])

function collectLoopScopeAliases(template: string): Set<string> {
  const aliases = new Set<string>()
  const tagMatches = template.match(WX_FOR_TAG_RE) ?? []
  for (const tag of tagMatches) {
    const itemMatch = tag.match(WX_FOR_ITEM_RE)
    if (itemMatch) {
      const itemAlias = (itemMatch[1] ?? itemMatch[2] ?? '').trim()
      if (itemAlias) {
        aliases.add(itemAlias)
      }
    }
    else {
      aliases.add('item')
    }

    const indexMatch = tag.match(WX_FOR_INDEX_RE)
    if (indexMatch) {
      const indexAlias = (indexMatch[1] ?? indexMatch[2] ?? '').trim()
      if (indexAlias) {
        aliases.add(indexAlias)
      }
    }
    else {
      aliases.add('index')
    }
  }
  return aliases
}

function extractTemplateExpressions(template: string): string[] {
  const expressions: string[] = []
  let match = TEMPLATE_MUSTACHE_RE.exec(template)
  while (match) {
    const expression = (match[1] ?? '').trim()
    if (expression) {
      expressions.push(expression)
    }
    match = TEMPLATE_MUSTACHE_RE.exec(template)
  }
  TEMPLATE_MUSTACHE_RE.lastIndex = 0
  return expressions
}

function collectIdentifiersFromExpression(expression: string): Set<string> {
  const collected = new Set<string>()
  let ast: t.File | undefined
  try {
    ast = parse(`const __weappViteExpr = (${expression});`, {
      ...BABEL_TS_MODULE_PARSER_OPTIONS,
      sourceType: 'module',
    }) as unknown as t.File
  }
  catch {
    return collected
  }

  traverse(ast, {
    Identifier(path: any) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (name === '__weappViteExpr') {
        return
      }
      if (path.scope.hasBinding(name, true)) {
        return
      }
      if (JS_GLOBAL_IDENTIFIERS.has(name)) {
        return
      }
      collected.add(name)
    },
    MemberExpression(path: any) {
      const member = path.node
      if (member.computed || member.object.type !== 'ThisExpression' || member.property.type !== 'Identifier') {
        return
      }
      collected.add(member.property.name)
    },
    OptionalMemberExpression(path: any) {
      const member = path.node
      if (member.computed || member.object.type !== 'ThisExpression' || member.property.type !== 'Identifier') {
        return
      }
      collected.add(member.property.name)
    },
  })

  return collected
}

function collectPatternBindingNames(node: any, bindings: Set<string>) {
  if (!node) {
    return
  }

  if (node.type === 'Identifier') {
    bindings.add(node.name)
    return
  }

  if (node.type === 'RestElement') {
    collectPatternBindingNames(node.argument, bindings)
    return
  }

  if (node.type === 'AssignmentPattern') {
    collectPatternBindingNames(node.left, bindings)
    return
  }

  if (node.type === 'ArrayPattern') {
    for (const element of node.elements ?? []) {
      collectPatternBindingNames(element, bindings)
    }
    return
  }

  if (node.type === 'ObjectPattern') {
    for (const property of node.properties ?? []) {
      if (property?.type === 'RestElement') {
        collectPatternBindingNames(property.argument, bindings)
      }
      else {
        collectPatternBindingNames(property?.value, bindings)
      }
    }
  }
}

function collectIdentifiersFromExpressionWithOxc(expression: string): Set<string> {
  const collected = new Set<string>()
  let ast: any

  try {
    ast = parseJsLikeWithEngine(`const __weappViteExpr = (${expression});`, {
      engine: 'oxc',
      filename: 'inline.ts',
    })
  }
  catch {
    return collected
  }

  const scopes: Set<string>[] = [new Set()]

  function hasBinding(name: string) {
    return scopes.some(scope => scope.has(name))
  }

  function visit(node: any) {
    if (!node) {
      return
    }

    if (node.type === 'ReturnStatement') {
      visit(node.argument)
      return
    }

    if (node.type === 'IfStatement') {
      visit(node.test)
      visit(node.consequent)
      visit(node.alternate)
      return
    }

    switch (node.type) {
      case 'Program':
        for (const statement of node.body ?? []) {
          visit(statement)
        }
        return
      case 'ExpressionStatement':
        visit(node.expression)
        return
      case 'ParenthesizedExpression':
      case 'TSAsExpression':
      case 'TSSatisfiesExpression':
      case 'TSNonNullExpression':
        visit(node.expression)
        return
      case 'VariableDeclaration':
        for (const declaration of node.declarations ?? []) {
          visit(declaration)
        }
        return
      case 'VariableDeclarator': {
        const bindings = new Set<string>()
        collectPatternBindingNames(node.id, bindings)
        const currentScope = scopes.at(-1)
        for (const binding of bindings) {
          currentScope?.add(binding)
        }
        visit(node.init)
        return
      }
      case 'Identifier':
        if (
          node.name !== '__weappViteExpr'
          && !hasBinding(node.name)
          && !JS_GLOBAL_IDENTIFIERS.has(node.name)
        ) {
          collected.add(node.name)
        }
        return
      case 'ChainExpression':
        visit(node.expression)
        return
      case 'MemberExpression':
        if (node.object?.type === 'ThisExpression' && !node.computed && node.property?.type === 'Identifier') {
          collected.add(node.property.name)
          return
        }
        visit(node.object)
        if (node.computed) {
          visit(node.property)
        }
        return
      case 'CallExpression':
      case 'NewExpression':
        visit(node.callee)
        for (const argument of node.arguments ?? []) {
          if (argument?.type === 'SpreadElement') {
            visit(argument.argument)
          }
          else {
            visit(argument)
          }
        }
        return
      case 'ArrayExpression':
        for (const element of node.elements ?? []) {
          if (element?.type === 'SpreadElement') {
            visit(element.argument)
          }
          else {
            visit(element)
          }
        }
        return
      case 'ObjectExpression':
        for (const property of node.properties ?? []) {
          visit(property)
        }
        return
      case 'ObjectProperty':
      case 'Property':
        if (node.computed) {
          visit(node.key)
        }
        visit(node.value)
        return
      case 'SpreadProperty':
      case 'SpreadElement':
        visit(node.argument)
        return
      case 'TemplateLiteral':
        for (const expressionNode of node.expressions ?? []) {
          visit(expressionNode)
        }
        return
      case 'TaggedTemplateExpression':
        visit(node.tag)
        visit(node.quasi)
        return
      case 'UnaryExpression':
      case 'UpdateExpression':
      case 'AwaitExpression':
        visit(node.argument)
        return
      case 'BinaryExpression':
      case 'LogicalExpression':
      case 'AssignmentExpression':
        visit(node.left)
        visit(node.right)
        return
      case 'ConditionalExpression':
        visit(node.test)
        visit(node.consequent)
        visit(node.alternate)
        return
      case 'SequenceExpression':
        for (const expressionNode of node.expressions ?? []) {
          visit(expressionNode)
        }
        return
      case 'ArrowFunctionExpression':
      case 'FunctionExpression': {
        const nextScope = new Set<string>()
        if (node.type === 'FunctionExpression' && node.id?.type === 'Identifier') {
          nextScope.add(node.id.name)
        }
        for (const parameter of node.params ?? []) {
          collectPatternBindingNames(parameter, nextScope)
        }
        scopes.unshift(nextScope)
        visit(node.body)
        scopes.shift()
        return
      }
      case 'BlockStatement': {
        scopes.unshift(new Set<string>())
        for (const statement of node.body ?? []) {
          visit(statement)
        }
        scopes.shift()
        break
      }
      default:
        break
    }
  }

  visit(ast)
  return collected
}

function collectWithBabel(template: string): string[] {
  const templateExpressions = extractTemplateExpressions(template)
  if (!templateExpressions.length) {
    return []
  }
  const loopAliases = collectLoopScopeAliases(template)
  const keys = new Set<string>()
  for (const expression of templateExpressions) {
    const identifiers = collectIdentifiersFromExpression(expression)
    for (const identifier of identifiers) {
      if (!loopAliases.has(identifier)) {
        keys.add(identifier)
      }
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
}

function collectWithOxc(template: string): string[] {
  const templateExpressions = extractTemplateExpressions(template)
  if (!templateExpressions.length) {
    return []
  }
  const loopAliases = collectLoopScopeAliases(template)
  const keys = new Set<string>()
  for (const expression of templateExpressions) {
    const identifiers = collectIdentifiersFromExpressionWithOxc(expression)
    for (const identifier of identifiers) {
      if (!loopAliases.has(identifier)) {
        keys.add(identifier)
      }
    }
  }
  return [...keys].sort((a, b) => a.localeCompare(b))
}

/**
 * 从编译后的 WXML 模板提取渲染相关的顶层 key。
 *
 * 根据 AST 引擎从编译后的 WXML 模板提取渲染相关的顶层 key。
 */
export function collectSetDataPickKeysFromTemplateCode(
  template: string,
  options?: {
    astEngine?: AstEngineName
  },
): string[] {
  if (!template.includes('{{')) {
    return []
  }

  const engine = options?.astEngine ?? 'babel'

  try {
    return engine === 'oxc' ? collectWithOxc(template) : collectWithBabel(template)
  }
  catch {
    return []
  }
}
