import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import type { VueTransformResult } from 'wevu/compiler'
import type { ConfigService } from '../../../runtime/config/types'
import * as t from '@weapp-vite/ast/babelTypes'
import fs from 'fs-extra'
import path from 'pathe'
import { parse as parseSfc } from 'vue/compiler-sfc'
import { findCssEntry, findJsEntry, findJsonEntry, findTemplateEntry } from '../../../utils'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../../utils/babel'
import { normalizeWatchPath, toPosixPath } from '../../../utils/path'
import { usingComponentFromResolvedFile } from '../../../utils/usingComponentFrom'

const PAGE_META_MACRO_NAME = 'definePageMeta'
const VUE_LIKE_EXTENSIONS = ['.vue', '.tsx', '.jsx'] as const
const CAMEL_TO_KEBAB_RE = /([a-z0-9])([A-Z])/g
const LAYOUT_NAME_SEPARATORS_RE = /[_\s]+/g
const DUPLICATE_DASH_RE = /-+/g
const EDGE_DASH_RE = /^-|-$/g
const PATH_SEGMENT_RE = /[\\/]/

export interface ResolvedPageLayout {
  file: string
  importPath: string
  kind: 'native' | 'vue'
  layoutName: string
  tagName: string
  props?: Record<string, LayoutPropValue>
}

export interface NativeLayoutAssets {
  json?: string
  template?: string
  style?: string
  script?: string
}

interface DiscoveredLayoutFile {
  file: string
  kind: 'native' | 'vue'
  layoutName: string
  tagName: string
}

export type LayoutPropValue = string | number | boolean | null | {
  kind: 'expression'
  expression: string
}

interface ResolvedLayoutMeta {
  name?: string
  props?: Record<string, LayoutPropValue>
  disabled?: boolean
}

function toKebabCase(input: string) {
  return input
    .replace(CAMEL_TO_KEBAB_RE, '$1-$2')
    .replace(LAYOUT_NAME_SEPARATORS_RE, '-')
    .replace(DUPLICATE_DASH_RE, '-')
    .replace(EDGE_DASH_RE, '')
    .toLowerCase()
}

function normalizeLayoutName(input: string) {
  return input
    .split(PATH_SEGMENT_RE)
    .filter(Boolean)
    .map(segment => toKebabCase(segment))
    .filter(Boolean)
    .join('-')
}

function toLayoutTagName(layoutName: string) {
  return `weapp-layout-${layoutName}`
}

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

function parseScriptAst(content: string, _filename: string) {
  return babelParse(content, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
}

export function extractPageLayoutMeta(source: string, filename: string) {
  if (filename.endsWith('.vue')) {
    const { descriptor } = parseSfc(source, { filename })
    let layout: ResolvedLayoutMeta | undefined

    if (descriptor.script?.content) {
      layout = extractLayoutFromProgram(parseScriptAst(descriptor.script.content, filename), filename)
    }
    if (descriptor.scriptSetup?.content) {
      const setupLayout = extractLayoutFromProgram(parseScriptAst(descriptor.scriptSetup.content, filename), filename)
      if (layout !== undefined && setupLayout !== undefined) {
        throw new Error(`${filename} 中的 <script> 与 <script setup> 不能同时声明 definePageMeta().`)
      }
      if (setupLayout !== undefined) {
        layout = setupLayout
      }
    }

    return layout
  }

  return extractLayoutFromProgram(parseScriptAst(source, filename), filename)
}

export function extractPageLayoutName(source: string, filename: string) {
  const meta = extractPageLayoutMeta(source, filename)
  return meta?.disabled ? false : meta?.name
}

async function collectLayoutFiles(root: string): Promise<Map<string, DiscoveredLayoutFile>> {
  const layoutMap = new Map<string, DiscoveredLayoutFile>()

  async function walk(dir: string) {
    let entries: string[]
    try {
      entries = await fs.readdir(dir)
    }
    catch {
      return
    }

    for (const entry of entries) {
      const full = path.join(dir, entry)
      const stat = await fs.stat(full)
      if (stat.isDirectory()) {
        await walk(full)
        continue
      }
      if (!VUE_LIKE_EXTENSIONS.some(ext => full.endsWith(ext))) {
        const templateEntry = await findTemplateEntry(full)
        if (!templateEntry.path || templateEntry.path !== full) {
          continue
        }

        const base = full.slice(0, -path.extname(full).length)
        const jsonEntry = await findJsonEntry(base)
        if (!jsonEntry.path) {
          continue
        }

        const relativePath = path.relative(root, base)
        const parts = relativePath.split(PATH_SEGMENT_RE).filter(Boolean)
        if (parts.at(-1) === 'index') {
          parts.pop()
        }
        const layoutName = normalizeLayoutName(parts.join('/'))
        if (!layoutName) {
          continue
        }
        const duplicated = layoutMap.get(layoutName)
        if (duplicated && duplicated.file !== base) {
          throw new Error(`layouts 目录中存在重复布局名 "${layoutName}"：${duplicated.file} 与 ${base}`)
        }
        layoutMap.set(layoutName, {
          file: base,
          kind: 'native',
          layoutName,
          tagName: toLayoutTagName(layoutName),
        })
        continue
      }

      const relativePath = path.relative(root, full)
      const ext = path.extname(relativePath)
      const withoutExt = relativePath.slice(0, -ext.length)
      const parts = withoutExt.split(PATH_SEGMENT_RE).filter(Boolean)
      if (parts.at(-1) === 'index') {
        parts.pop()
      }
      const layoutName = normalizeLayoutName(parts.join('/'))
      if (!layoutName) {
        continue
      }
      const duplicated = layoutMap.get(layoutName)
      if (duplicated && duplicated.file !== full) {
        throw new Error(`layouts 目录中存在重复布局名 "${layoutName}"：${duplicated.file} 与 ${full}`)
      }
      layoutMap.set(layoutName, {
        file: full,
        kind: 'vue',
        layoutName,
        tagName: toLayoutTagName(layoutName),
      })
    }
  }

  await walk(root)
  return layoutMap
}

function ensureRelativeImportPath(fromFile: string, targetFile: string) {
  const relativePath = path.relative(path.dirname(fromFile), targetFile)
  const normalized = toPosixPath(relativePath)
  if (normalized.startsWith('.')) {
    return normalized
  }
  return `./${normalized}`
}

function mergeLayoutUsingComponent(config: string | undefined, tagName: string, importPath: string) {
  const parsed = config ? JSON.parse(config) : {}
  const usingComponents = parsed.usingComponents && typeof parsed.usingComponents === 'object' && !Array.isArray(parsed.usingComponents)
    ? parsed.usingComponents
    : {}

  usingComponents[tagName] = importPath
  parsed.usingComponents = usingComponents
  return JSON.stringify(parsed, null, 2)
}

/**
 * 解析页面布局配置，默认回退到 `layouts/default.*`。
 */
export async function resolvePageLayout(
  source: string,
  filename: string,
  configService: Pick<ConfigService, 'absoluteSrcRoot' | 'relativeOutputPath'>,
): Promise<ResolvedPageLayout | undefined> {
  const layoutMeta = extractPageLayoutMeta(source, filename)
  if (layoutMeta?.disabled) {
    return undefined
  }

  const layoutsRoot = path.join(configService.absoluteSrcRoot, 'layouts')
  const layoutFiles = await collectLayoutFiles(layoutsRoot)
  const selectedName = typeof layoutMeta?.name === 'string'
    ? layoutMeta.name
    : layoutFiles.has('default')
      ? 'default'
      : undefined

  if (!selectedName) {
    return undefined
  }

  const layoutFile = layoutFiles.get(selectedName)
  if (!layoutFile) {
    throw new Error(`${filename} 指定的 layout "${selectedName}" 不存在，请检查 ${layoutsRoot} 目录。`)
  }

  const importPath = usingComponentFromResolvedFile(layoutFile.file, configService)
  if (!importPath) {
    throw new Error(`无法为 layout "${selectedName}" 解析 usingComponents 路径：${layoutFile.file}`)
  }

  return {
    ...layoutFile,
    importPath,
    props: layoutMeta?.props,
  }
}

function escapeDoubleQuotedAttr(value: string) {
  return value
    .replaceAll('&', '&amp;')
    .replaceAll('"', '&quot;')
    .replaceAll('<', '&lt;')
}

function toKebabAttrName(key: string) {
  return toKebabCase(key)
}

function stripTypeSyntaxFromAst(ast: BabelFile) {
  traverse(ast, {
    CallExpression(path: any) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
      }
    },
    NewExpression(path: any) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
      }
    },
    TSAsExpression(path: any) {
      path.replaceWith(path.node.expression)
    },
    TSSatisfiesExpression(path: any) {
      path.replaceWith(path.node.expression)
    },
    TSTypeAssertion(path: any) {
      path.replaceWith(path.node.expression)
    },
    TSNonNullExpression(path: any) {
      path.replaceWith(path.node.expression)
    },
  })
}

function parseExpressionAst(expression: string) {
  const file = babelParse(`const __wv_layout_expr__ = ${expression}`, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  stripTypeSyntaxFromAst(file)
  const stmt = file.program.body[0]
  if (!stmt || !t.isVariableDeclaration(stmt)) {
    return null
  }
  const declarator = stmt.declarations[0]
  if (!declarator || !declarator.init || !t.isExpression(declarator.init)) {
    return null
  }
  return declarator.init
}

function createStaticObjectKey(key: string) {
  return t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key)
}

function getObjectPropertyByKey(node: t.ObjectExpression, key: string): t.ObjectProperty | null {
  for (const prop of node.properties) {
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    if ((t.isIdentifier(prop.key) && prop.key.name === key) || (t.isStringLiteral(prop.key) && prop.key.value === key)) {
      return prop
    }
  }
  return null
}

function findWevuOptionsObject(ast: BabelFile) {
  let matched: t.ObjectExpression | null = null

  traverse(ast, {
    VariableDeclarator(path: any) {
      if (!t.isIdentifier(path.node.id, { name: '__wevuOptions' }) || !t.isObjectExpression(path.node.init)) {
        return
      }
      matched = path.node.init
      path.stop()
    },
    ExportDefaultDeclaration(path: any) {
      if (matched || !t.isObjectExpression(path.node.declaration)) {
        return
      }
      matched = path.node.declaration
      path.stop()
    },
  })

  return matched
}

function injectLayoutBindingComputed(script: string | undefined, props: Record<string, LayoutPropValue> | undefined) {
  if (!script || !props) {
    return script
  }

  const runtimeEntries = Object.entries(props)
    .filter((entry): entry is [string, { kind: 'expression', expression: string }] => typeof entry[1] === 'object' && entry[1] !== null && 'kind' in entry[1] && entry[1].kind === 'expression')

  if (runtimeEntries.length === 0) {
    return script
  }

  const ast = babelParse(script, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  const optionsObject = findWevuOptionsObject(ast)
  if (!optionsObject) {
    return script
  }

  const computedEntries = runtimeEntries.map(([key, value]) => {
    const expressionAst = parseExpressionAst(value.expression) ?? t.identifier('undefined')
    return t.objectProperty(
      createStaticObjectKey(`__wv_layout_bind_${key}`),
      t.functionExpression(
        null,
        [],
        t.blockStatement([
          t.tryStatement(
            t.blockStatement([
              t.returnStatement(expressionAst),
            ]),
            t.catchClause(
              t.identifier('__wv_expr_err'),
              t.blockStatement([
                t.returnStatement(t.identifier('undefined')),
              ]),
            ),
            null,
          ),
        ]),
      ),
    )
  })

  const computedProp = getObjectPropertyByKey(optionsObject, 'computed')
  if (!computedProp) {
    optionsObject.properties.unshift(
      t.objectProperty(createStaticObjectKey('computed'), t.objectExpression(computedEntries)),
    )
  }
  else if (t.isObjectExpression(computedProp.value)) {
    computedProp.value.properties.push(...computedEntries)
  }
  else if (t.isIdentifier(computedProp.value) || t.isMemberExpression(computedProp.value)) {
    computedProp.value = t.objectExpression([
      ...computedEntries,
      t.spreadElement(t.cloneNode(computedProp.value, true)),
    ])
  }
  else {
    return script
  }

  return generate(ast, { retainLines: true }).code
}

function serializeLayoutProps(props: Record<string, LayoutPropValue> | undefined) {
  if (!props || Object.keys(props).length === 0) {
    return ''
  }

  const attrs = Object.entries(props).map(([key, value]) => {
    const attrName = toKebabAttrName(key)
    if (typeof value === 'string') {
      return `${attrName}="${escapeDoubleQuotedAttr(value)}"`
    }
    if (typeof value === 'object' && value && 'kind' in value && value.kind === 'expression') {
      return `${attrName}="{{__wv_layout_bind_${key}}}"`
    }
    if (typeof value === 'number' || typeof value === 'boolean' || value === null) {
      return `${attrName}="{{${String(value)}}}"`
    }
    return ''
  }).filter(Boolean)

  return attrs.length > 0 ? ` ${attrs.join(' ')}` : ''
}

function collapseNestedLayoutWrapper(template: string, tagName: string) {
  const closeTag = `</${tagName}>`
  let next = template

  while (next.startsWith(`<${tagName}`) && next.endsWith(closeTag)) {
    const openTagEnd = next.indexOf('>')
    if (openTagEnd < 0) {
      break
    }
    const inner = next.slice(openTagEnd + 1, -closeTag.length)
    if (!inner.startsWith(`<${tagName}`)) {
      break
    }
    next = inner
  }

  return next
}

/**
 * 将页面模板包裹进 layout 组件，并补齐 usingComponents 与依赖导入。
 */
export function applyPageLayout(
  result: VueTransformResult,
  filename: string,
  layout: ResolvedPageLayout | undefined,
) {
  if (!layout || !result.template) {
    return result
  }

  const serializedProps = serializeLayoutProps(layout.props)
  if (result.template.startsWith(`<${layout.tagName}`)) {
    result.template = collapseNestedLayoutWrapper(result.template, layout.tagName)
    result.script = injectLayoutBindingComputed(result.script, layout.props)
    result.config = mergeLayoutUsingComponent(result.config, layout.tagName, layout.importPath)
    return result
  }
  result.template = `<${layout.tagName}${serializedProps}>${result.template}</${layout.tagName}>`
  result.script = injectLayoutBindingComputed(result.script, layout.props)
  result.config = mergeLayoutUsingComponent(result.config, layout.tagName, layout.importPath)

  if (layout.kind === 'vue') {
    const layoutImport = ensureRelativeImportPath(filename, layout.file)
    const sideEffectImport = `import ${JSON.stringify(layoutImport)}\n`
    if (!result.script?.includes(sideEffectImport)) {
      result.script = `${sideEffectImport}${result.script ?? 'export default {}'}`
    }
  }

  return result
}

/**
 * 判断文件是否位于 `layouts/` 目录下，用于失效页面编译缓存。
 */
export function isLayoutFile(
  filename: string,
  configService: Pick<ConfigService, 'absoluteSrcRoot'>,
) {
  const layoutsRoot = `${normalizeWatchPath(path.join(configService.absoluteSrcRoot, 'layouts'))}/`
  const normalizedFile = normalizeWatchPath(filename)
  return normalizedFile.startsWith(layoutsRoot)
}

export async function collectNativeLayoutAssets(basePath: string): Promise<NativeLayoutAssets> {
  const [jsonEntry, templateEntry, styleEntry, scriptEntry] = await Promise.all([
    findJsonEntry(basePath),
    findTemplateEntry(basePath),
    findCssEntry(basePath),
    findJsEntry(basePath),
  ])

  return {
    json: jsonEntry.path,
    template: templateEntry.path,
    style: styleEntry.path,
    script: scriptEntry.path,
  }
}
