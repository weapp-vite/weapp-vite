import type { TransformContext } from './types'
import * as t from '@babel/types'
import { LRUCache } from 'lru-cache'
import { parse as babelParse, generate, parseJsLike, traverse } from '../../../../utils/babel'

// 说明：`lru-cache@11` 的值类型要求非空（`V extends {}`），这里用 `false` 作为“缓存未命中”的哨兵值。
const babelExpressionCache = new LRUCache<string, t.Expression | false>({ max: 1024 })
const inlineHandlerCache = new LRUCache<string, { name: string, args: any[] } | false>({ max: 1024 })

const BABEL_GENERATE_MINI_PROGRAM_OPTIONS = {
  compact: true,
  // 注意：WXML 不会像 JS 一样解析 `\\uXXXX` 转义序列，必须尽量保留原始 UTF-8 字符。
  jsescOption: { quotes: 'single' as const, minimal: true },
}

function generateExpression(node: t.Expression): string {
  const { code } = generate(node, BABEL_GENERATE_MINI_PROGRAM_OPTIONS)
  return code
}

function parseBabelExpression(exp: string): t.Expression | null {
  const cached = babelExpressionCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      babelExpressionCache.set(exp, false)
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    babelExpressionCache.set(exp, expression)
    return expression
  }
  catch {
    babelExpressionCache.set(exp, false)
    return null
  }
}

function parseBabelExpressionFile(exp: string): { ast: t.File, expression: t.Expression } | null {
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    }) as t.File
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    return { ast, expression }
  }
  catch {
    return null
  }
}

export function normalizeClassBindingExpression(exp: string, context: TransformContext): string[] {
  const ast = parseBabelExpression(exp)
  if (!ast) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }

  const out: string[] = []

  const pushExpr = (node: t.Expression) => {
    out.push(normalizeWxmlExpressionWithContext(generateExpression(node), context))
  }

  const visit = (node: t.Expression | null | undefined) => {
    if (!node) {
      return
    }
    if (t.isArrayExpression(node)) {
      for (const el of node.elements) {
        if (!el) {
          continue
        }
        if (t.isSpreadElement(el)) {
          context.warnings.push('小程序不支持 :class 的展开语法，已忽略。')
          continue
        }
        if (t.isExpression(el)) {
          visit(el)
        }
      }
      return
    }
    if (t.isObjectExpression(node)) {
      for (const prop of node.properties) {
        if (t.isSpreadElement(prop)) {
          context.warnings.push('小程序不支持 :class 对象的展开语法，已忽略。')
          continue
        }
        if (!t.isObjectProperty(prop)) {
          continue
        }
        const value = prop.value
        if (!t.isExpression(value)) {
          continue
        }
        const test = value
        if (prop.computed) {
          const keyExpr = prop.key
          if (!t.isExpression(keyExpr)) {
            continue
          }
          pushExpr(t.conditionalExpression(test, keyExpr, t.stringLiteral('')))
        }
        else if (t.isIdentifier(prop.key)) {
          pushExpr(t.conditionalExpression(test, t.stringLiteral(prop.key.name), t.stringLiteral('')))
        }
        else if (t.isStringLiteral(prop.key)) {
          pushExpr(t.conditionalExpression(test, t.stringLiteral(prop.key.value), t.stringLiteral('')))
        }
      }
      return
    }

    pushExpr(node)
  }

  visit(ast)

  if (!out.length) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }
  return out
}

export function normalizeStyleBindingExpression(exp: string, context: TransformContext): string[] {
  const ast = parseBabelExpression(exp)
  if (!ast) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }

  const out: string[] = []

  const pushExpr = (node: t.Expression) => {
    out.push(normalizeWxmlExpressionWithContext(generateExpression(node), context))
  }

  const buildKeyExpression = (key: t.Expression | t.Identifier | t.StringLiteral | t.NumericLiteral | t.BooleanLiteral, computed: boolean) => {
    if (computed) {
      return t.isExpression(key) ? key : null
    }
    if (t.isIdentifier(key)) {
      return t.stringLiteral(key.name)
    }
    if (t.isStringLiteral(key)) {
      return t.stringLiteral(key.value)
    }
    if (t.isNumericLiteral(key)) {
      return t.stringLiteral(String(key.value))
    }
    if (t.isBooleanLiteral(key)) {
      return t.stringLiteral(String(key.value))
    }
    return null
  }

  const buildStylePair = (keyExpr: t.Expression, valueExpr: t.Expression) => {
    return t.callExpression(
      t.memberExpression(t.identifier('__weapp_vite'), t.identifier('stylePair')),
      [keyExpr, valueExpr],
    )
  }

  const visit = (node: t.Expression | null | undefined) => {
    if (!node) {
      return
    }
    if (t.isArrayExpression(node)) {
      for (const el of node.elements) {
        if (!el) {
          continue
        }
        if (t.isSpreadElement(el)) {
          context.warnings.push('小程序不支持 :style 的展开语法，已忽略。')
          continue
        }
        if (t.isExpression(el)) {
          visit(el)
        }
      }
      return
    }
    if (t.isObjectExpression(node)) {
      for (const prop of node.properties) {
        if (t.isSpreadElement(prop)) {
          context.warnings.push('小程序不支持 :style 对象的展开语法，已忽略。')
          continue
        }
        if (!t.isObjectProperty(prop)) {
          continue
        }
        const value = prop.value
        if (!t.isExpression(value)) {
          continue
        }
        const keyExpr = buildKeyExpression(prop.key as any, prop.computed)
        if (!keyExpr) {
          continue
        }
        pushExpr(buildStylePair(keyExpr, value))
      }
      return
    }

    pushExpr(node)
  }

  visit(ast)

  if (!out.length) {
    return [normalizeWxmlExpressionWithContext(exp, context)]
  }
  return out
}

export function parseInlineHandler(exp: string): { name: string, args: any[] } | null {
  const cached = inlineHandlerCache.get(exp)
  if (cached !== undefined) {
    return cached === false ? null : cached
  }
  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression
    if (!t.isCallExpression(expression) || !t.isIdentifier(expression.callee)) {
      return null
    }
    const name = expression.callee.name
    const args: any[] = []
    for (const arg of expression.arguments) {
      if (t.isIdentifier(arg) && arg.name === '$event') {
        args.push('$event')
      }
      else if (t.isStringLiteral(arg) || t.isNumericLiteral(arg) || t.isBooleanLiteral(arg)) {
        args.push(arg.value)
      }
      else if (t.isNullLiteral(arg)) {
        args.push(null)
      }
      else {
        inlineHandlerCache.set(exp, false)
        return null
      }
    }
    const out = { name, args }
    inlineHandlerCache.set(exp, out)
    return out
  }
  catch {
    inlineHandlerCache.set(exp, false)
    return null
  }
}

function templateLiteralToConcat(node: t.TemplateLiteral): t.Expression {
  const segments: t.Expression[] = []

  node.quasis.forEach((quasi, index) => {
    const cooked = quasi.value.cooked ?? quasi.value.raw ?? ''
    if (cooked) {
      segments.push(t.stringLiteral(cooked))
    }
    if (index < node.expressions.length) {
      let inner = node.expressions[index] as t.Expression
      if (t.isTemplateLiteral(inner)) {
        inner = templateLiteralToConcat(inner)
      }
      segments.push(inner)
    }
  })

  if (segments.length === 0) {
    return t.stringLiteral('')
  }
  if (segments.length === 1) {
    return segments[0]
  }

  return segments.reduce((acc, cur) => t.binaryExpression('+', acc, cur))
}

export function normalizeWxmlExpression(exp: string): string {
  if (!exp.includes('`') && !exp.includes('??')) {
    return exp
  }

  try {
    const ast = babelParse(`(${exp})`, {
      sourceType: 'module',
      plugins: ['typescript'],
    })
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return exp
    }

    traverse(ast, {
      LogicalExpression(path) {
        if (path.node.operator !== '??') {
          return
        }
        const left = path.node.left
        const right = path.node.right
        const test = t.binaryExpression('!=', t.cloneNode(left), t.nullLiteral())
        path.replaceWith(t.conditionalExpression(test, t.cloneNode(left), t.cloneNode(right)))
        path.skip()
      },
      TemplateLiteral(path) {
        if (t.isTaggedTemplateExpression(path.parent)) {
          return
        }
        path.replaceWith(templateLiteralToConcat(path.node))
      },
    })
    const normalized = (stmt as any).expression as t.Expression
    const { code } = generate(normalized, BABEL_GENERATE_MINI_PROGRAM_OPTIONS)
    return code
  }
  catch {
    // 回退：简单把模板字符串改写为字符串拼接
    if (exp.startsWith('`') && exp.endsWith('`')) {
      const inner = exp.slice(1, -1)
      let rewritten = `'${inner.replace(/\$\{([^}]+)\}/g, '\' + ($1) + \'')}'`
      // 移除边界处冗余的 `+ ''`
      rewritten = rewritten.replace(/'\s*\+\s*''/g, '\'').replace(/''\s*\+\s*'/g, '\'')
      rewritten = rewritten.replace(/^\s*''\s*\+\s*/g, '').replace(/\s*\+\s*''\s*$/g, '')
      return rewritten
    }

    return exp
  }
}

const SCOPED_SLOT_GLOBALS = new Set([
  'Math',
  'Number',
  'Date',
  'Array',
  'Object',
  'Boolean',
  'String',
  'RegExp',
  'Map',
  'Set',
  'JSON',
  'Intl',
  'console',
  'Infinity',
  'undefined',
  'NaN',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'require',
  'arguments',
  '__wvOwner',
  '__wvSlotProps',
  '__wvSlotPropsData',
  '__weapp_vite',
])

const JS_RUNTIME_GLOBALS = new Set([
  'Math',
  'Number',
  'Date',
  'Array',
  'Object',
  'Boolean',
  'String',
  'RegExp',
  'Map',
  'Set',
  'WeakMap',
  'WeakSet',
  'Promise',
  'Symbol',
  'BigInt',
  'JSON',
  'Intl',
  'console',
  'Infinity',
  'undefined',
  'NaN',
  'isFinite',
  'isNaN',
  'parseFloat',
  'parseInt',
  'decodeURI',
  'decodeURIComponent',
  'encodeURI',
  'encodeURIComponent',
  'require',
  'arguments',
  'globalThis',
  'wx',
  'getApp',
  'getCurrentPages',
])

function collectScopedSlotLocals(context: TransformContext): Set<string> {
  const locals = new Set<string>()
  for (const scope of context.scopeStack) {
    for (const name of scope) {
      locals.add(name)
    }
  }
  return locals
}

function collectSlotPropMapping(context: TransformContext): Record<string, string> {
  const mapping: Record<string, string> = {}
  for (const entry of context.slotPropStack) {
    Object.assign(mapping, entry)
  }
  return mapping
}

function parseJsExpressionFile(exp: string): { ast: t.File, expression: t.Expression } | null {
  try {
    const ast = parseJsLike(`(${exp})`)
    const stmt = ast.program.body[0]
    if (!stmt || !('expression' in stmt)) {
      return null
    }
    const expression = (stmt as any).expression as t.Expression
    return { ast, expression }
  }
  catch {
    return null
  }
}

function rewriteScopedSlotExpression(exp: string, context: TransformContext): string {
  const normalized = normalizeWxmlExpression(exp)
  const parsed = parseBabelExpressionFile(normalized)
  if (!parsed) {
    return normalized
  }
  const { ast } = parsed
  const locals = collectScopedSlotLocals(context)
  const slotProps = collectSlotPropMapping(context)
  const createMemberAccess = (target: string, prop: string) => {
    if (!prop) {
      return t.identifier(target)
    }
    if (/^[A-Z_$][\w$]*$/i.test(prop)) {
      return t.memberExpression(t.identifier(target), t.identifier(prop))
    }
    return t.memberExpression(t.identifier(target), t.stringLiteral(prop), true)
  }

  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (SCOPED_SLOT_GLOBALS.has(name)) {
        return
      }
      if (locals.has(name)) {
        return
      }
      if (Object.prototype.hasOwnProperty.call(slotProps, name)) {
        const member = createMemberAccess('__wvSlotPropsData', slotProps[name])
        const parent = path.parentPath
        if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
          parent.node.shorthand = false
          parent.node.value = member
          return
        }
        path.replaceWith(member)
        return
      }
      const member = createMemberAccess('__wvOwner', name)
      const parent = path.parentPath
      if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
        parent.node.shorthand = false
        parent.node.value = member
        return
      }
      path.replaceWith(member)
    },
  })

  const stmt = ast.program.body[0]
  const updatedExpression = (stmt && 'expression' in stmt) ? (stmt as any).expression as t.Expression : null
  return updatedExpression ? generateExpression(updatedExpression) : normalized
}

export function normalizeWxmlExpressionWithContext(exp: string, context?: TransformContext): string {
  if (!context?.rewriteScopedSlot) {
    return normalizeWxmlExpression(exp)
  }
  return rewriteScopedSlotExpression(exp, context)
}

function createMemberAccess(target: t.Expression, prop: string): t.Expression {
  if (!prop) {
    return target
  }
  if (t.isValidIdentifier(prop)) {
    return t.memberExpression(target, t.identifier(prop))
  }
  return t.memberExpression(target, t.stringLiteral(prop), true)
}

function createThisMemberAccess(prop: string): t.Expression {
  return createMemberAccess(t.thisExpression(), prop)
}

export function normalizeJsExpressionWithContext(
  exp: string,
  context: TransformContext,
  options?: { hint?: string },
): t.Expression | null {
  const trimmed = exp.trim()
  if (!trimmed) {
    return null
  }
  const normalized = normalizeWxmlExpression(trimmed)
  const parsed = parseJsExpressionFile(normalized)
  if (!parsed) {
    const hint = options?.hint ? `${options.hint} ` : ''
    context.warnings.push(`${hint}模板表达式解析失败，已忽略：${exp}`)
    return null
  }

  const { ast } = parsed
  const locals = collectScopedSlotLocals(context)
  const slotProps = context.rewriteScopedSlot ? collectSlotPropMapping(context) : {}

  traverse(ast, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (JS_RUNTIME_GLOBALS.has(name)) {
        return
      }
      if (path.scope.hasBinding(name)) {
        return
      }
      if (locals.has(name)) {
        return
      }

      let replacement: t.Expression
      if (context.rewriteScopedSlot) {
        if (Object.prototype.hasOwnProperty.call(slotProps, name)) {
          const prop = slotProps[name]
          const base = createThisMemberAccess('__wvSlotPropsData')
          replacement = prop ? createMemberAccess(base, prop) : base
        }
        else if (
          name === '__wvOwner'
          || name === '__wvSlotPropsData'
          || name === '__wvSlotProps'
          || name === '__wvSlotScope'
        ) {
          replacement = createThisMemberAccess(name)
        }
        else {
          const base = createThisMemberAccess('__wvOwner')
          replacement = createMemberAccess(base, name)
        }
      }
      else {
        replacement = createThisMemberAccess(name)
      }

      const parent = path.parentPath
      if (parent.isObjectProperty() && parent.node.shorthand && parent.node.key === path.node) {
        parent.node.shorthand = false
        parent.node.value = replacement
        return
      }
      path.replaceWith(replacement)
    },
  })

  const stmt = ast.program.body[0]
  const updated = (stmt && 'expression' in stmt) ? (stmt as any).expression as t.Expression : null
  return updated || null
}
