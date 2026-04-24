import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import type { LayoutPropValue, ResolvedLayoutMeta } from './types'
import * as t from '@weapp-vite/ast/babelTypes'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../../utils/babel'
import { normalizeLayoutName } from './shared'

const PAGE_META_MACRO_NAME = 'definePageMeta'
const analyzedPageLayoutSourceCache = new Map<string, {
  source: string
  result: {
    layoutMeta?: ResolvedLayoutMeta
    dynamicSwitch: boolean
    dynamicPropKeys: string[]
  }
}>()

function unwrapStaticExpression(node: t.Expression): t.Expression {
  if (t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node) || t.isTypeCastExpression(node)) {
    return unwrapStaticExpression(node.expression as t.Expression)
  }
  if (t.isParenthesizedExpression(node)) {
    return unwrapStaticExpression(node.expression)
  }
  return node
}

function extractStaticLayoutPropValue(node: t.Expression, filename: string, keyName: string): LayoutPropValue {
  const normalized = unwrapStaticExpression(node)
  if (t.isStringLiteral(normalized)) {
    return normalized.value
  }
  if (t.isNumericLiteral(normalized)) {
    return normalized.value
  }
  if (t.isBooleanLiteral(normalized)) {
    return normalized.value
  }
  if (t.isNullLiteral(normalized)) {
    return null
  }

  const expression = generate(normalized, { compact: true }).code
  if (!expression) {
    throw new Error(`${filename} 中 definePageMeta().layout.props.${keyName} 无法解析为表达式。`)
  }
  return {
    kind: 'expression',
    expression,
  }
}

function extractLayoutPropsFromObject(node: t.ObjectExpression, filename: string) {
  const props: Record<string, LayoutPropValue> = {}

  for (const property of node.properties) {
    if (!t.isObjectProperty(property) || property.computed || !t.isExpression(property.value)) {
      throw new Error(`${filename} 中 definePageMeta().layout.props 仅支持普通对象字面量。`)
    }

    const key = property.key
    const keyName = t.isIdentifier(key)
      ? key.name
      : t.isStringLiteral(key)
        ? key.value
        : undefined

    if (!keyName) {
      throw new Error(`${filename} 中 definePageMeta().layout.props 仅支持静态键名。`)
    }

    props[keyName] = extractStaticLayoutPropValue(property.value, filename, keyName)
  }

  return props
}

function extractLayoutValueFromObject(node: t.ObjectExpression, filename: string) {
  let layout: ResolvedLayoutMeta | undefined

  for (const property of node.properties) {
    if (!t.isObjectProperty(property) || property.computed) {
      continue
    }
    const key = property.key
    const isLayoutKey = (t.isIdentifier(key) && key.name === 'layout')
      || (t.isStringLiteral(key) && key.value === 'layout')
    if (!isLayoutKey || !t.isExpression(property.value)) {
      continue
    }

    const normalized = unwrapStaticExpression(property.value)
    if (t.isBooleanLiteral(normalized, { value: false })) {
      layout = { disabled: true }
      continue
    }
    if (t.isStringLiteral(normalized)) {
      const next = normalizeLayoutName(normalized.value)
      if (!next) {
        throw new Error(`${filename} 中 definePageMeta().layout 不能为空字符串。`)
      }
      layout = { name: next }
      continue
    }
    if (t.isObjectExpression(normalized)) {
      let nextName: string | undefined
      let nextProps: Record<string, LayoutPropValue> | undefined

      for (const nestedProperty of normalized.properties) {
        if (!t.isObjectProperty(nestedProperty) || nestedProperty.computed || !t.isExpression(nestedProperty.value)) {
          throw new Error(`${filename} 中 definePageMeta().layout 对象仅支持静态字面量字段。`)
        }

        const nestedKey = nestedProperty.key
        const nestedKeyName = t.isIdentifier(nestedKey)
          ? nestedKey.name
          : t.isStringLiteral(nestedKey)
            ? nestedKey.value
            : undefined

        if (!nestedKeyName) {
          throw new Error(`${filename} 中 definePageMeta().layout 对象仅支持静态键名。`)
        }

        if (nestedKeyName === 'name') {
          const nameValue = unwrapStaticExpression(nestedProperty.value)
          if (!t.isStringLiteral(nameValue)) {
            throw new Error(`${filename} 中 definePageMeta().layout.name 必须是静态字符串。`)
          }
          const normalizedName = normalizeLayoutName(nameValue.value)
          if (!normalizedName) {
            throw new Error(`${filename} 中 definePageMeta().layout.name 不能为空字符串。`)
          }
          nextName = normalizedName
          continue
        }

        if (nestedKeyName === 'props') {
          const propsValue = unwrapStaticExpression(nestedProperty.value)
          if (!t.isObjectExpression(propsValue)) {
            throw new Error(`${filename} 中 definePageMeta().layout.props 必须是对象字面量。`)
          }
          nextProps = extractLayoutPropsFromObject(propsValue, filename)
          continue
        }
      }

      if (!nextName) {
        throw new Error(`${filename} 中 definePageMeta().layout 对象必须提供 name 字段。`)
      }
      layout = {
        name: nextName,
        props: nextProps,
      }
      continue
    }

    throw new Error(`${filename} 中 definePageMeta().layout 仅支持静态字符串、false，或 { name, props } 对象。`)
  }

  return layout
}

function extractLayoutFromProgram(ast: BabelFile, filename: string) {
  let layout: ResolvedLayoutMeta | undefined
  let macroCount = 0

  for (const statement of ast.program.body) {
    if (!t.isExpressionStatement(statement) || !t.isCallExpression(statement.expression)) {
      continue
    }
    const call = statement.expression
    if (!t.isIdentifier(call.callee, { name: PAGE_META_MACRO_NAME })) {
      continue
    }
    macroCount += 1
    if (call.arguments.length !== 1) {
      throw new Error(`${filename} 中 definePageMeta() 必须且只能接收一个对象参数。`)
    }
    const firstArg = call.arguments[0]
    if (t.isSpreadElement(firstArg) || !t.isExpression(firstArg)) {
      throw new Error(`${filename} 中 definePageMeta() 仅支持对象字面量参数。`)
    }
    const normalized = unwrapStaticExpression(firstArg)
    if (!t.isObjectExpression(normalized)) {
      throw new Error(`${filename} 中 definePageMeta() 仅支持对象字面量参数。`)
    }
    layout = extractLayoutValueFromObject(normalized, filename)
  }

  if (macroCount > 1) {
    throw new Error(`${filename} 中 definePageMeta() 只能声明一次。`)
  }

  return layout
}

function hasSetPageLayoutCallInProgram(ast: BabelFile) {
  let matched = false
  traverse(ast, {
    CallExpression(path: any) {
      if (t.isIdentifier(path.node.callee, { name: 'setPageLayout' })) {
        matched = true
        path.stop()
      }
    },
  })
  return matched
}

function collectSetPageLayoutPropKeysFromProgram(ast: BabelFile) {
  const keys = new Set<string>()

  traverse(ast, {
    CallExpression(path: any) {
      if (!t.isIdentifier(path.node.callee, { name: 'setPageLayout' })) {
        return
      }
      const secondArg = path.node.arguments[1]
      if (!secondArg || t.isSpreadElement(secondArg) || !t.isObjectExpression(secondArg)) {
        return
      }
      for (const property of secondArg.properties) {
        if (!t.isObjectProperty(property) || property.computed) {
          continue
        }
        const key = property.key
        const keyName = t.isIdentifier(key)
          ? key.name
          : t.isStringLiteral(key)
            ? key.value
            : undefined
        if (keyName) {
          keys.add(keyName)
        }
      }
    },
  })

  return [...keys]
}

function parseScriptAst(content: string) {
  return babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
}

function analyzeVueScriptBlocks(source: string, filename: string) {
  const { descriptor } = parseSfc(source, { filename })
  const scriptAst = descriptor.script?.content
    ? parseScriptAst(descriptor.script.content)
    : undefined
  const scriptSetupAst = descriptor.scriptSetup?.content
    ? parseScriptAst(descriptor.scriptSetup.content)
    : undefined

  return {
    descriptor,
    scriptAst,
    scriptSetupAst,
  }
}

function analyzePageLayoutSourceUncached(source: string, filename: string) {
  if (filename.endsWith('.vue')) {
    const { scriptAst, scriptSetupAst } = analyzeVueScriptBlocks(source, filename)
    let layoutMeta: ResolvedLayoutMeta | undefined

    if (scriptAst) {
      layoutMeta = extractLayoutFromProgram(scriptAst, filename)
    }
    if (scriptSetupAst) {
      const setupLayout = extractLayoutFromProgram(scriptSetupAst, filename)
      if (layoutMeta !== undefined && setupLayout !== undefined) {
        throw new Error(`${filename} 中的 <script> 与 <script setup> 不能同时声明 definePageMeta().`)
      }
      if (setupLayout !== undefined) {
        layoutMeta = setupLayout
      }
    }

    const dynamicSwitch = Boolean(
      (scriptAst && hasSetPageLayoutCallInProgram(scriptAst))
      || (scriptSetupAst && hasSetPageLayoutCallInProgram(scriptSetupAst)),
    )
    const dynamicPropKeys = dynamicSwitch
      ? Array.from(new Set([
          ...(scriptAst ? collectSetPageLayoutPropKeysFromProgram(scriptAst) : []),
          ...(scriptSetupAst ? collectSetPageLayoutPropKeysFromProgram(scriptSetupAst) : []),
        ]))
      : []

    return {
      layoutMeta,
      dynamicSwitch,
      dynamicPropKeys,
    }
  }

  const ast = parseScriptAst(source)
  const dynamicSwitch = hasSetPageLayoutCallInProgram(ast)
  return {
    layoutMeta: extractLayoutFromProgram(ast, filename),
    dynamicSwitch,
    dynamicPropKeys: dynamicSwitch ? collectSetPageLayoutPropKeysFromProgram(ast) : [],
  }
}

export function analyzePageLayoutSource(source: string, filename: string) {
  const cached = analyzedPageLayoutSourceCache.get(filename)
  if (cached?.source === source) {
    return cached.result
  }

  const result = analyzePageLayoutSourceUncached(source, filename)
  analyzedPageLayoutSourceCache.set(filename, {
    source,
    result,
  })
  return result
}

export function invalidatePageLayoutSourceAnalysisCache(filename?: string) {
  if (!filename) {
    analyzedPageLayoutSourceCache.clear()
    return
  }
  analyzedPageLayoutSourceCache.delete(filename)
}

export function extractPageLayoutMeta(source: string, filename: string) {
  return analyzePageLayoutSource(source, filename).layoutMeta
}

export function hasSetPageLayoutUsage(source: string, filename: string) {
  return analyzePageLayoutSource(source, filename).dynamicSwitch
}

export function collectSetPageLayoutPropKeys(source: string, filename: string) {
  return analyzePageLayoutSource(source, filename).dynamicPropKeys
}

export function extractPageLayoutName(source: string, filename: string) {
  const meta = extractPageLayoutMeta(source, filename)
  return meta?.disabled ? false : meta?.name
}
