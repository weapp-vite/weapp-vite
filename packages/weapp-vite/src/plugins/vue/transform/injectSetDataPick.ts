import type { NodePath } from '@babel/traverse'
import type * as t from '@babel/types'
import type { WeappViteConfig } from '../../../types'
import { BABEL_TS_MODULE_PARSER_OPTIONS, generate, parse, parseJsLike, traverse } from '../../../utils/babel'

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

/**
 * 根据配置判断是否启用自动 setData.pick 注入。
 */
export function isAutoSetDataPickEnabled(config?: WeappViteConfig): boolean {
  return Boolean(config?.wevu?.autoSetDataPick)
}

function isTargetWevuComponentCall(callee: t.Expression | t.V8IntrinsicIdentifier): boolean {
  if (callee.type === 'Identifier') {
    return callee.name === 'createWevuComponent' || callee.name === 'defineComponent'
  }
  if (callee.type !== 'MemberExpression' || callee.computed) {
    return false
  }
  return callee.property.type === 'Identifier'
    && (callee.property.name === 'createWevuComponent' || callee.property.name === 'defineComponent')
}

function getObjectPropertyByKey(objectExpression: t.ObjectExpression, key: string): t.ObjectProperty | undefined {
  for (const member of objectExpression.properties) {
    if (member.type !== 'ObjectProperty') {
      continue
    }
    if (member.key.type === 'Identifier' && member.key.name === key) {
      return member
    }
    if (member.key.type === 'StringLiteral' && member.key.value === key) {
      return member
    }
  }
  return undefined
}

function unwrapExpression(node: t.Expression): t.Expression {
  let current = node
  while (true) {
    if (current.type === 'TSAsExpression' || current.type === 'TSTypeAssertion' || current.type === 'TSNonNullExpression' || current.type === 'ParenthesizedExpression' || current.type === 'TSSatisfiesExpression') {
      current = current.expression as t.Expression
      continue
    }
    return current
  }
}

function resolveOptionsObjectExpression(
  expression: t.Expression | undefined,
  scope: NodePath['scope'],
): t.ObjectExpression | undefined {
  if (!expression) {
    return undefined
  }
  const unwrapped = unwrapExpression(expression)
  if (unwrapped.type === 'ObjectExpression') {
    return unwrapped
  }
  if (unwrapped.type === 'Identifier') {
    const binding = scope.getBinding(unwrapped.name)
    if (!binding || !binding.path.isVariableDeclarator()) {
      return undefined
    }
    const init = binding.path.node.init
    if (!init || (init.type !== 'ObjectExpression' && init.type !== 'CallExpression' && init.type !== 'Identifier')) {
      return undefined
    }
    return resolveOptionsObjectExpression(init as t.Expression, binding.path.scope)
  }
  if (
    unwrapped.type === 'CallExpression'
    && unwrapped.callee.type === 'MemberExpression'
    && !unwrapped.callee.computed
    && unwrapped.callee.object.type === 'Identifier'
    && unwrapped.callee.object.name === 'Object'
    && unwrapped.callee.property.type === 'Identifier'
    && unwrapped.callee.property.name === 'assign'
  ) {
    for (let i = unwrapped.arguments.length - 1; i >= 0; i--) {
      const arg = unwrapped.arguments[i]
      if (arg.type !== 'SpreadElement') {
        const resolved = resolveOptionsObjectExpression(arg as t.Expression, scope)
        if (resolved) {
          return resolved
        }
      }
    }
  }
  return undefined
}

function createPickArrayExpression(keys: string[]): t.ArrayExpression {
  return {
    type: 'ArrayExpression',
    elements: keys.map(key => ({ type: 'StringLiteral', value: key })),
  }
}

function mergePickArrayExpression(
  arrayExpression: t.ArrayExpression,
  keys: string[],
): boolean {
  const existing = new Set<string>()
  for (const element of arrayExpression.elements) {
    if (element && element.type === 'StringLiteral') {
      existing.add(element.value)
    }
  }
  let changed = false
  for (const key of keys) {
    if (existing.has(key)) {
      continue
    }
    arrayExpression.elements.push({ type: 'StringLiteral', value: key })
    existing.add(key)
    changed = true
  }
  return changed
}

function injectPickIntoSetDataObject(setDataObject: t.ObjectExpression, keys: string[]): boolean {
  const pickProp = getObjectPropertyByKey(setDataObject, 'pick')
  if (!pickProp) {
    setDataObject.properties.unshift({
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: 'pick' },
      computed: false,
      shorthand: false,
      value: createPickArrayExpression(keys),
    })
    return true
  }
  if (pickProp.value.type !== 'ArrayExpression') {
    return false
  }
  return mergePickArrayExpression(pickProp.value, keys)
}

function injectPickIntoOptionsObject(optionsObject: t.ObjectExpression, keys: string[]): boolean {
  const setDataProp = getObjectPropertyByKey(optionsObject, 'setData')
  if (!setDataProp) {
    optionsObject.properties.unshift({
      type: 'ObjectProperty',
      key: { type: 'Identifier', name: 'setData' },
      computed: false,
      shorthand: false,
      value: {
        type: 'ObjectExpression',
        properties: [
          {
            type: 'ObjectProperty',
            key: { type: 'Identifier', name: 'pick' },
            computed: false,
            shorthand: false,
            value: createPickArrayExpression(keys),
          },
        ],
      },
    })
    return true
  }

  const setDataValue = unwrapExpression(setDataProp.value as t.Expression)
  if (setDataValue.type === 'ObjectExpression') {
    return injectPickIntoSetDataObject(setDataValue, keys)
  }
  if (
    setDataValue.type === 'Identifier'
    || setDataValue.type === 'MemberExpression'
    || setDataValue.type === 'CallExpression'
  ) {
    setDataProp.value = {
      type: 'ObjectExpression',
      properties: [
        {
          type: 'ObjectProperty',
          key: { type: 'Identifier', name: 'pick' },
          computed: false,
          shorthand: false,
          value: createPickArrayExpression(keys),
        },
        {
          type: 'SpreadElement',
          argument: setDataValue,
        },
      ],
    }
    return true
  }
  return false
}

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
    Identifier(path) {
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
    MemberExpression(path) {
      const member = path.node
      if (member.computed || member.object.type !== 'ThisExpression' || member.property.type !== 'Identifier') {
        return
      }
      collected.add(member.property.name)
    },
    OptionalMemberExpression(path) {
      const member = path.node
      if (member.computed || member.object.type !== 'ThisExpression' || member.property.type !== 'Identifier') {
        return
      }
      collected.add(member.property.name)
    },
  })

  return collected
}

/**
 * 从编译后的 WXML 模板提取渲染相关的顶层 key。
 */
export function collectSetDataPickKeysFromTemplate(template: string): string[] {
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
  return Array.from(keys).sort((a, b) => a.localeCompare(b))
}

/**
 * 在 wevu 组件脚本中注入 setData.pick。
 */
export function injectSetDataPickInJs(
  source: string,
  pickKeys: string[],
): { code: string, transformed: boolean } {
  if (!pickKeys.length) {
    return { code: source, transformed: false }
  }

  const ast = parseJsLike(source)
  const candidateOptions = new Set<t.ObjectExpression>()
  traverse(ast, {
    CallExpression(path) {
      if (!isTargetWevuComponentCall(path.node.callee)) {
        return
      }
      const firstArg = path.node.arguments[0]
      if (!firstArg || firstArg.type === 'SpreadElement') {
        return
      }
      const resolvedOptions = resolveOptionsObjectExpression(firstArg as t.Expression, path.scope)
      if (resolvedOptions) {
        candidateOptions.add(resolvedOptions)
      }
    },
  })

  if (!candidateOptions.size) {
    return { code: source, transformed: false }
  }

  let changed = false
  for (const optionsObject of candidateOptions) {
    changed = injectPickIntoOptionsObject(optionsObject, pickKeys) || changed
  }
  if (!changed) {
    return { code: source, transformed: false }
  }

  const generated = generate(ast, { retainLines: true })
  return { code: generated.code, transformed: true }
}
