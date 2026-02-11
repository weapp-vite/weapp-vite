import type {
  Expression,
  JSXAttribute,
  JSXChild,
  JSXElement,
  JSXExpressionContainer,
  JSXFragment,
  JSXIdentifier,
  JSXNamespacedName,
  JSXSpreadAttribute,
  ObjectExpression,
} from '@babel/types'
import type { InlineExpressionAsset, TemplateCompileOptions } from '../vue/compiler/template/types'
import type { CompileVueFileOptions, VueTransformResult } from '../vue/transform/compileVueFile/types'
import * as t from '@babel/types'
import { removeExtensionDeep } from '@weapp-core/shared'
import path from 'pathe'
import { isBuiltinComponent } from '../../auto-import-components/builtin'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate, traverse } from '../../utils/babel'
import { isAutoImportCandidateTag, RESERVED_VUE_COMPONENT_TAGS } from '../../utils/vueTemplateTags'
import { normalizeWxmlExpression } from '../vue/compiler/template/expression/wxml'
import { wechatPlatform } from '../vue/compiler/template/platforms'
import { extractJsonMacroFromScriptSetup } from '../vue/transform/jsonMacros'
import { JSON_MACROS } from '../vue/transform/jsonMacros/parse'
import { createJsonMerger } from '../vue/transform/jsonMerge'
import { transformScript } from '../vue/transform/script'
import { resolveComponentExpression } from '../vue/transform/scriptComponent'
import { collectWevuPageFeatureFlags } from '../wevu/pageFeatures'
import { mergePageConfigFromFeatures } from '../wevu/pageFeatures/pageConfig'

interface JsxCompileContext {
  platform: NonNullable<TemplateCompileOptions['platform']>
  mustacheInterpolation: NonNullable<TemplateCompileOptions['mustacheInterpolation']>
  warnings: string[]
  inlineExpressions: InlineExpressionAsset[]
  inlineExpressionSeed: number
  scopeStack: string[]
}

interface JsxImportedComponent {
  localName: string
  importSource: string
  importedName?: string
  kind: 'default' | 'named'
}

interface JsxAutoComponentContext {
  templateTags: Set<string>
  importedComponents: JsxImportedComponent[]
}

const ESCAPED_TEXT_RE = /[&<>]/g
const ESCAPED_ATTR_RE = /[&"<>]/g

const ESCAPED_TEXT_MAP: Record<string, string> = {
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
}

const ESCAPED_ATTR_MAP: Record<string, string> = {
  '&': '&amp;',
  '"': '&quot;',
  '<': '&lt;',
  '>': '&gt;',
}

function escapeText(value: string) {
  return value.replace(ESCAPED_TEXT_RE, ch => ESCAPED_TEXT_MAP[ch] || ch)
}

function escapeAttr(value: string) {
  return value.replace(ESCAPED_ATTR_RE, ch => ESCAPED_ATTR_MAP[ch] || ch)
}

function normalizeJsxText(value: string) {
  return value.replace(/\s+/g, ' ')
}

function printExpression(exp: Expression) {
  return generate(exp).code
}

function unwrapTsExpression(exp: Expression): Expression {
  let current: Expression = exp
  while (
    t.isTSAsExpression(current)
    || t.isTSTypeAssertion(current)
    || t.isTSNonNullExpression(current)
    || t.isParenthesizedExpression(current)
    || t.isTSInstantiationExpression(current)
  ) {
    if (t.isTSAsExpression(current) || t.isTSTypeAssertion(current) || t.isTSNonNullExpression(current)) {
      current = current.expression as Expression
      continue
    }
    if (t.isParenthesizedExpression(current)) {
      current = current.expression as Expression
      continue
    }
    if (t.isTSInstantiationExpression(current)) {
      current = current.expression as Expression
    }
  }
  return current
}

function normalizeInterpolationExpression(exp: Expression) {
  return normalizeWxmlExpression(printExpression(unwrapTsExpression(exp)))
}

function renderMustache(expression: string, context: Pick<JsxCompileContext, 'mustacheInterpolation'>) {
  return context.mustacheInterpolation === 'spaced'
    ? `{{ ${expression} }}`
    : `{{${expression}}}`
}

function pushScope(context: JsxCompileContext, names: string[]) {
  for (const name of names) {
    if (!name) {
      continue
    }
    context.scopeStack.push(name)
  }
}

function popScope(context: JsxCompileContext, count: number) {
  for (let i = 0; i < count; i += 1) {
    context.scopeStack.pop()
  }
}

function collectExpressionScopeBindings(exp: Expression, context: JsxCompileContext): string[] {
  const localSet = new Set(context.scopeStack)
  if (!localSet.size) {
    return []
  }

  const used: string[] = []
  const usedSet = new Set<string>()
  const file = t.file(t.program([t.expressionStatement(t.cloneNode(exp, true))]))

  traverse(file, {
    Identifier(path) {
      if (!path.isReferencedIdentifier()) {
        return
      }
      const name = path.node.name
      if (!localSet.has(name)) {
        return
      }
      if (path.scope.hasBinding(name)) {
        return
      }
      if (usedSet.has(name)) {
        return
      }
      usedSet.add(name)
      used.push(name)
    },
  })

  return used
}

function registerInlineExpression(exp: Expression, context: JsxCompileContext) {
  const scopeKeys = collectExpressionScopeBindings(exp, context)
  const id = `__wv_inline_${context.inlineExpressionSeed++}`
  context.inlineExpressions.push({
    id,
    expression: printExpression(exp),
    scopeKeys,
  })
  return {
    id,
    scopeKeys,
  }
}

function toStaticObjectKey(key: Expression | t.PrivateName | t.Identifier) {
  if (t.isIdentifier(key)) {
    return key.name
  }
  if (t.isStringLiteral(key)) {
    return key.value
  }
  return null
}

function getObjectPropertyByKey(node: ObjectExpression, key: string) {
  for (const prop of node.properties) {
    if (t.isObjectMethod(prop)) {
      const name = toStaticObjectKey(prop.key)
      if (name === key) {
        return prop
      }
      continue
    }
    if (!t.isObjectProperty(prop) || prop.computed) {
      continue
    }
    const name = toStaticObjectKey(prop.key)
    if (name === key) {
      return prop
    }
  }
  return null
}

function toJsxTagName(name: JSXIdentifier | JSXNamespacedName | t.JSXMemberExpression, context: JsxCompileContext): string {
  if (t.isJSXIdentifier(name)) {
    return name.name
  }
  if (t.isJSXNamespacedName(name)) {
    return `${name.namespace.name}:${name.name.name}`
  }

  context.warnings.push('暂不支持 JSX 成员标签（如 <Foo.Bar />），已回退为 <view />。')
  return 'view'
}

function resolveRenderableExpression(
  node: t.ObjectMethod | t.ObjectProperty,
) {
  if (t.isObjectMethod(node)) {
    for (const statement of node.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        return unwrapTsExpression(statement.argument as Expression)
      }
    }
    return null
  }

  if (!node.value) {
    return null
  }

  const value = node.value
  if (t.isArrowFunctionExpression(value)) {
    if (t.isBlockStatement(value.body)) {
      for (const statement of value.body.body) {
        if (t.isReturnStatement(statement) && statement.argument) {
          return unwrapTsExpression(statement.argument as Expression)
        }
      }
      return null
    }
    return unwrapTsExpression(value.body as Expression)
  }

  if (t.isFunctionExpression(value)) {
    for (const statement of value.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        return unwrapTsExpression(statement.argument as Expression)
      }
    }
  }

  return null
}

function removeRenderOptionFromObjectExpression(node: ObjectExpression) {
  const nextProps = node.properties.filter((prop) => {
    if (t.isObjectMethod(prop)) {
      return toStaticObjectKey(prop.key) !== 'render'
    }
    if (t.isObjectProperty(prop) && !prop.computed) {
      return toStaticObjectKey(prop.key) !== 'render'
    }
    return true
  })
  const removed = nextProps.length !== node.properties.length
  if (removed) {
    node.properties = nextProps
  }
  return removed
}

function stripRenderOptionFromScript(source: string, filename: string, warn?: (message: string) => void) {
  let ast: t.File
  try {
    ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  }
  catch {
    return source
  }

  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, ObjectExpression>()
  let removedRender = false
  let removedJsonMacroImport = false

  traverse(ast, {
    ImportDeclaration(path) {
      const importSource = path.node.source.value

      if (importSource === 'wevu' || importSource === 'vue') {
        for (const specifier of path.node.specifiers) {
          if (!t.isImportSpecifier(specifier)) {
            continue
          }
          if (!t.isIdentifier(specifier.imported, { name: 'defineComponent' })) {
            continue
          }
          defineComponentAliases.add(specifier.local.name)
        }
      }

      if (importSource !== 'weapp-vite') {
        return
      }

      const retained = path.node.specifiers.filter((specifier) => {
        if (!t.isImportSpecifier(specifier)) {
          return true
        }
        const importedName = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : t.isStringLiteral(specifier.imported)
            ? specifier.imported.value
            : ''
        return !JSON_MACROS.has(importedName)
      })

      if (retained.length === path.node.specifiers.length) {
        return
      }

      removedJsonMacroImport = true
      if (retained.length === 0) {
        path.remove()
      }
      else {
        path.node.specifiers = retained
      }
    },
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, path.node.init)
        return
      }
      if (!t.isCallExpression(path.node.init)) {
        return
      }
      const callee = path.node.init.callee
      if (!t.isIdentifier(callee) || !defineComponentAliases.has(callee.name)) {
        return
      }
      const first = path.node.init.arguments[0]
      if (t.isObjectExpression(first)) {
        defineComponentDecls.set(path.node.id.name, first)
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration
      if (t.isDeclaration(declaration)) {
        return
      }

      if (t.isObjectExpression(declaration)) {
        removedRender = removeRenderOptionFromObjectExpression(declaration) || removedRender
        return
      }

      if (t.isCallExpression(declaration)) {
        const callee = declaration.callee
        if (!t.isIdentifier(callee) || !defineComponentAliases.has(callee.name)) {
          return
        }
        const first = declaration.arguments[0]
        if (t.isObjectExpression(first)) {
          removedRender = removeRenderOptionFromObjectExpression(first) || removedRender
        }
        return
      }

      if (t.isIdentifier(declaration)) {
        const target = defineComponentDecls.get(declaration.name)
        if (target) {
          removedRender = removeRenderOptionFromObjectExpression(target) || removedRender
        }
      }
    },
  })

  if (!removedRender) {
    warn?.(`[JSX 编译] 未在 ${filename} 中移除 render 选项，输出脚本可能包含 JSX。`)
  }

  if (!removedRender && !removedJsonMacroImport) {
    return source
  }

  return generate(ast).code
}

function resolveRenderExpression(componentExpr: Expression, context: JsxCompileContext): Expression | null {
  if (!t.isObjectExpression(componentExpr)) {
    context.warnings.push('JSX 编译仅支持对象字面量组件选项。')
    return null
  }

  const renderNode = getObjectPropertyByKey(componentExpr, 'render')
  if (!renderNode) {
    context.warnings.push('未找到 render()，请在默认导出组件中声明 render 函数。')
    return null
  }

  if (!t.isObjectMethod(renderNode) && !t.isObjectProperty(renderNode)) {
    context.warnings.push('render 不是可执行函数。')
    return null
  }

  return resolveRenderableExpression(renderNode)
}

function isEventBinding(name: string) {
  return /^on[A-Z]/.test(name)
    || /^catch[A-Z]/.test(name)
    || /^captureBind[A-Z]/.test(name)
    || /^captureCatch[A-Z]/.test(name)
    || /^mutBind[A-Z]/.test(name)
}

function lowerEventName(name: string) {
  if (!name) {
    return name
  }
  return name
    .replace(/^[A-Z]/, s => s.toLowerCase())
    .replace(/[A-Z]/g, s => s.toLowerCase())
}

function toEventBindingName(rawName: string, context: JsxCompileContext) {
  const resolveEvent = (name: string) => context.platform.mapEventName(lowerEventName(name))

  if (/^captureBind[A-Z]/.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('captureBind'.length))
    return context.platform.eventBindingAttr(`capture-bind:${eventName}`)
  }
  if (/^captureCatch[A-Z]/.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('captureCatch'.length))
    return context.platform.eventBindingAttr(`capture-catch:${eventName}`)
  }
  if (/^mutBind[A-Z]/.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('mutBind'.length))
    return context.platform.eventBindingAttr(`mut-bind:${eventName}`)
  }
  if (/^catch[A-Z]/.test(rawName)) {
    const eventName = resolveEvent(rawName.slice('catch'.length))
    return context.platform.eventBindingAttr(`catch:${eventName}`)
  }

  const eventName = resolveEvent(rawName.slice('on'.length))
  return context.platform.eventBindingAttr(`bind:${eventName}`)
}

function readJsxAttributeExpression(value: JSXAttribute['value']) {
  if (!value) {
    return t.booleanLiteral(true) as Expression
  }
  if (t.isStringLiteral(value)) {
    return value as Expression
  }
  if (!t.isJSXExpressionContainer(value)) {
    return null
  }
  if (t.isJSXEmptyExpression(value.expression)) {
    return null
  }
  return unwrapTsExpression(value.expression as Expression)
}

function extractJsxKeyExpression(node: JSXElement): string | null {
  for (const attr of node.openingElement.attributes) {
    if (!t.isJSXAttribute(attr) || !t.isJSXIdentifier(attr.name)) {
      continue
    }
    if (attr.name.name !== 'key') {
      continue
    }
    const exp = readJsxAttributeExpression(attr.value)
    if (!exp) {
      return null
    }
    if (t.isStringLiteral(exp)) {
      return exp.value
    }
    return normalizeInterpolationExpression(exp)
  }
  return null
}

function compileEventAttribute(
  name: string,
  value: JSXAttribute['value'],
  context: JsxCompileContext,
): string[] {
  const bindAttr = toEventBindingName(name, context)
  const exp = readJsxAttributeExpression(value)
  if (!exp) {
    return []
  }

  if (t.isStringLiteral(exp) && exp.value) {
    return [`${bindAttr}="${escapeAttr(exp.value)}"`]
  }

  if (t.isIdentifier(exp)) {
    return [`${bindAttr}="${escapeAttr(exp.name)}"`]
  }

  if (
    t.isMemberExpression(exp)
    && !exp.computed
    && t.isThisExpression(exp.object)
    && t.isIdentifier(exp.property)
  ) {
    return [`${bindAttr}="${escapeAttr(exp.property.name)}"`]
  }

  const inline = registerInlineExpression(exp, context)
  const attrs = [`data-wv-inline-id="${inline.id}"`, `${bindAttr}="__weapp_vite_inline"`]
  inline.scopeKeys.forEach((scopeKey, index) => {
    attrs.push(`data-wv-s${index}="${renderMustache(scopeKey, context)}"`)
  })
  return attrs
}

function compileNormalAttribute(
  name: string,
  value: JSXAttribute['value'],
  context: JsxCompileContext,
): string | null {
  const normalizedName = name === 'className' ? 'class' : name
  const exp = readJsxAttributeExpression(value)
  if (!exp) {
    return null
  }

  if (t.isStringLiteral(exp)) {
    return `${normalizedName}="${escapeAttr(exp.value)}"`
  }

  if (t.isBooleanLiteral(exp)) {
    return `${normalizedName}="${renderMustache(String(exp.value), context)}"`
  }

  const normalizedExp = normalizeInterpolationExpression(exp)
  return `${normalizedName}="${renderMustache(normalizedExp, context)}"`
}

function compileJsxAttributes(
  attributes: Array<JSXAttribute | JSXSpreadAttribute>,
  context: JsxCompileContext,
): string[] {
  const output: string[] = []
  for (const attr of attributes) {
    if (t.isJSXSpreadAttribute(attr)) {
      context.warnings.push('暂不支持 JSX spread attributes，已忽略。')
      continue
    }
    if (!t.isJSXIdentifier(attr.name)) {
      context.warnings.push('暂不支持 JSX 动态属性名，已忽略。')
      continue
    }

    const name = attr.name.name
    if (name === 'key') {
      continue
    }

    if (isEventBinding(name)) {
      output.push(...compileEventAttribute(name, attr.value, context))
      continue
    }

    const normalAttr = compileNormalAttribute(name, attr.value, context)
    if (normalAttr) {
      output.push(normalAttr)
    }
  }
  return output
}

function compileListExpression(exp: Expression) {
  return normalizeInterpolationExpression(exp)
}

function compileMapExpression(exp: t.CallExpression, context: JsxCompileContext): string | null {
  const callee = exp.callee
  if (!t.isMemberExpression(callee) || !t.isIdentifier(callee.property, { name: 'map' })) {
    return null
  }

  const callback = exp.arguments[0]
  if (!callback || !(t.isArrowFunctionExpression(callback) || t.isFunctionExpression(callback))) {
    context.warnings.push('仅支持 map(fn) 形式的列表渲染。')
    return null
  }

  const listExp = compileListExpression(callee.object as Expression)
  const renderTemplateMustache = (expression: string) => renderMustache(expression, context)
  const itemParam = callback.params[0]
  const indexParam = callback.params[1]
  const item = t.isIdentifier(itemParam) ? itemParam.name : 'item'
  const index = t.isIdentifier(indexParam) ? indexParam.name : undefined

  const addedScope = [item, index].filter((name): name is string => !!name)
  pushScope(context, addedScope)

  let bodyExp: Expression | null = null
  if (t.isBlockStatement(callback.body)) {
    for (const statement of callback.body.body) {
      if (t.isReturnStatement(statement) && statement.argument) {
        bodyExp = unwrapTsExpression(statement.argument as Expression)
        break
      }
    }
  }
  else {
    bodyExp = unwrapTsExpression(callback.body as Expression)
  }

  const body = bodyExp ? compileRenderableExpression(bodyExp, context) : ''
  popScope(context, addedScope.length)

  if (!body) {
    return ''
  }

  let keyValue = context.platform.keyThisValue
  if (bodyExp && t.isJSXElement(bodyExp)) {
    const extracted = extractJsxKeyExpression(bodyExp)
    if (extracted) {
      keyValue = extracted
    }
    else if (index) {
      keyValue = index
    }
  }
  else if (index) {
    keyValue = index
  }

  const attrs = [
    ...context.platform.forAttrs(listExp, renderTemplateMustache, item, index),
    context.platform.keyAttr(keyValue),
  ]

  return `<block ${attrs.join(' ')}>${body}</block>`
}

function compileConditionalExpression(exp: t.ConditionalExpression, context: JsxCompileContext): string {
  const renderTemplateMustache = (expression: string) => renderMustache(expression, context)
  const test = normalizeInterpolationExpression(exp.test)
  const consequent = compileRenderableExpression(exp.consequent, context)
  const alternate = compileRenderableExpression(exp.alternate, context)

  if (!alternate) {
    return context.platform.wrapIf(test, consequent, renderTemplateMustache)
  }

  return `${context.platform.wrapIf(test, consequent, renderTemplateMustache)}${context.platform.wrapElse(alternate)}`
}

function compileLogicalExpression(exp: t.LogicalExpression, context: JsxCompileContext): string {
  const renderTemplateMustache = (expression: string) => renderMustache(expression, context)
  if (exp.operator === '&&') {
    const test = normalizeInterpolationExpression(exp.left)
    const content = compileRenderableExpression(exp.right, context)
    return context.platform.wrapIf(test, content, renderTemplateMustache)
  }
  if (exp.operator === '||') {
    const negated = t.unaryExpression('!', t.parenthesizedExpression(t.cloneNode(exp.left, true)))
    const test = normalizeInterpolationExpression(negated)
    const content = compileRenderableExpression(exp.right, context)
    return context.platform.wrapIf(test, content, renderTemplateMustache)
  }
  return renderMustache(normalizeInterpolationExpression(exp), context)
}

function compileRenderableExpression(exp: Expression, context: JsxCompileContext): string {
  const node = unwrapTsExpression(exp)
  if (t.isJSXElement(node)) {
    return compileJsxElement(node, context)
  }
  if (t.isJSXFragment(node)) {
    return compileJsxFragment(node, context)
  }
  if (t.isConditionalExpression(node)) {
    return compileConditionalExpression(node, context)
  }
  if (t.isLogicalExpression(node)) {
    return compileLogicalExpression(node, context)
  }
  if (t.isCallExpression(node)) {
    const mapped = compileMapExpression(node, context)
    if (mapped != null) {
      return mapped
    }
  }
  if (t.isArrayExpression(node)) {
    return node.elements
      .map((element) => {
        if (!element || !t.isExpression(element)) {
          return ''
        }
        return compileRenderableExpression(element, context)
      })
      .join('')
  }
  if (t.isNullLiteral(node) || t.isBooleanLiteral(node)) {
    return ''
  }

  return renderMustache(normalizeInterpolationExpression(node), context)
}

function compileExpressionContainer(node: JSXExpressionContainer, context: JsxCompileContext): string {
  const exp = node.expression
  if (t.isJSXEmptyExpression(exp)) {
    return ''
  }
  return compileRenderableExpression(exp as Expression, context)
}

function compileJsxChildren(children: JSXChild[], context: JsxCompileContext): string {
  const parts: string[] = []
  for (const child of children) {
    if (t.isJSXText(child)) {
      const normalized = normalizeJsxText(child.value)
      if (!normalized.trim()) {
        continue
      }
      parts.push(escapeText(normalized))
      continue
    }
    if (t.isJSXExpressionContainer(child)) {
      const chunk = compileExpressionContainer(child, context)
      if (chunk) {
        parts.push(chunk)
      }
      continue
    }
    if (t.isJSXElement(child)) {
      parts.push(compileJsxElement(child, context))
      continue
    }
    if (t.isJSXFragment(child)) {
      parts.push(compileJsxFragment(child, context))
      continue
    }
    if (t.isJSXSpreadChild(child)) {
      context.warnings.push('暂不支持 JSX spread child，已忽略。')
    }
  }
  return parts.join('')
}

function compileJsxFragment(node: JSXFragment, context: JsxCompileContext): string {
  return compileJsxChildren(node.children, context)
}

function compileJsxElement(node: JSXElement, context: JsxCompileContext): string {
  const tag = toJsxTagName(node.openingElement.name, context)
  const attrs = compileJsxAttributes(node.openingElement.attributes, context)
  const attrsSegment = attrs.length ? ` ${attrs.join(' ')}` : ''
  if (node.openingElement.selfClosing) {
    return `<${tag}${attrsSegment} />`
  }
  const children = compileJsxChildren(node.children, context)
  return `<${tag}${attrsSegment}>${children}</${tag}>`
}

function findExportDefaultExpression(ast: t.File): Expression | null {
  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, ObjectExpression>()
  let exportDefaultExpression: Expression | null = null

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value
      if (source !== 'wevu' && source !== 'vue') {
        return
      }
      for (const specifier of path.node.specifiers) {
        if (!t.isImportSpecifier(specifier)) {
          continue
        }
        if (!t.isIdentifier(specifier.imported, { name: 'defineComponent' })) {
          continue
        }
        defineComponentAliases.add(specifier.local.name)
      }
    },
    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(path.node.init, true))
        return
      }
      if (!t.isCallExpression(path.node.init)) {
        return
      }
      const callee = path.node.init.callee
      if (!t.isIdentifier(callee) || !defineComponentAliases.has(callee.name)) {
        return
      }
      const first = path.node.init.arguments[0]
      if (t.isObjectExpression(first)) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(first, true))
      }
    },
    ExportDefaultDeclaration(path) {
      const declaration = path.node.declaration
      if (t.isDeclaration(declaration)) {
        return
      }
      const resolved = resolveComponentExpression(declaration, defineComponentDecls, defineComponentAliases)
      exportDefaultExpression = resolved
    },
  })

  return exportDefaultExpression
}

function isCollectableJsxTemplateTag(tag: string) {
  if (!tag) {
    return false
  }
  if (RESERVED_VUE_COMPONENT_TAGS.has(tag)) {
    return false
  }
  return !isBuiltinComponent(tag)
}

function collectJsxTemplateTags(renderExpression: Expression) {
  const tags = new Set<string>()
  const file = t.file(t.program([t.expressionStatement(t.cloneNode(renderExpression, true))]))

  traverse(file, {
    JSXOpeningElement(path) {
      const { name } = path.node
      if (t.isJSXMemberExpression(name)) {
        return
      }
      let tag: string | null = null
      if (t.isJSXIdentifier(name)) {
        tag = name.name
      }
      else if (t.isJSXNamespacedName(name)) {
        tag = `${name.namespace.name}:${name.name.name}`
      }
      if (!tag || !isCollectableJsxTemplateTag(tag)) {
        return
      }
      tags.add(tag)
    },
  })

  return tags
}

function collectImportedComponents(ast: t.File) {
  const imports = new Map<string, JsxImportedComponent>()

  traverse(ast, {
    ImportDeclaration(path) {
      if (path.node.importKind === 'type') {
        return
      }
      if (!t.isStringLiteral(path.node.source)) {
        return
      }

      const importSource = path.node.source.value
      for (const specifier of path.node.specifiers) {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          continue
        }
        if (!('local' in specifier) || !t.isIdentifier(specifier.local)) {
          continue
        }

        const localName = specifier.local.name
        if (t.isImportDefaultSpecifier(specifier)) {
          imports.set(localName, {
            localName,
            importSource,
            importedName: 'default',
            kind: 'default',
          })
          continue
        }

        if (!t.isImportSpecifier(specifier)) {
          continue
        }

        const importedName = t.isIdentifier(specifier.imported)
          ? specifier.imported.name
          : t.isStringLiteral(specifier.imported)
            ? specifier.imported.value
            : undefined

        imports.set(localName, {
          localName,
          importSource,
          importedName,
          kind: 'named',
        })
      }
    },
  })

  return Array.from(imports.values())
}

function collectJsxAutoComponentContext(source: string, filename: string, warn?: (message: string) => void): JsxAutoComponentContext {
  const empty: JsxAutoComponentContext = {
    templateTags: new Set<string>(),
    importedComponents: [],
  }

  let ast: t.File
  try {
    ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warn?.(`[JSX 编译] 解析 ${filename} 失败，已跳过自动 usingComponents 推导：${message}`)
    return empty
  }

  const importedComponents = collectImportedComponents(ast)

  const context: JsxCompileContext = {
    platform: wechatPlatform,
    mustacheInterpolation: 'compact',
    warnings: [],
    inlineExpressions: [],
    inlineExpressionSeed: 0,
    scopeStack: [],
  }

  const componentExpr = findExportDefaultExpression(ast)
  if (!componentExpr) {
    return {
      templateTags: new Set<string>(),
      importedComponents,
    }
  }

  const renderExpression = resolveRenderExpression(componentExpr, context)
  if (!renderExpression) {
    return {
      templateTags: new Set<string>(),
      importedComponents,
    }
  }

  return {
    templateTags: collectJsxTemplateTags(renderExpression),
    importedComponents,
  }
}

function compileJsxTemplate(source: string, filename: string, options?: CompileVueFileOptions) {
  const ast = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS) as t.File
  const context: JsxCompileContext = {
    platform: options?.template?.platform ?? wechatPlatform,
    mustacheInterpolation: options?.template?.mustacheInterpolation ?? 'compact',
    warnings: [],
    inlineExpressions: [],
    inlineExpressionSeed: 0,
    scopeStack: [],
  }

  const componentExpr = findExportDefaultExpression(ast)
  if (!componentExpr) {
    context.warnings.push(`未在 ${filename} 中识别到默认导出组件。`)
    return {
      template: undefined,
      warnings: context.warnings,
      inlineExpressions: context.inlineExpressions,
    }
  }

  const renderExpression = resolveRenderExpression(componentExpr, context)
  if (!renderExpression) {
    return {
      template: undefined,
      warnings: context.warnings,
      inlineExpressions: context.inlineExpressions,
    }
  }

  const template = compileRenderableExpression(renderExpression, context)
  return {
    template,
    warnings: context.warnings,
    inlineExpressions: context.inlineExpressions,
  }
}

/**
 * 编译 JSX/TSX 文件，输出 wevu 脚本与 WXML 模板。
 */
export async function compileJsxFile(
  source: string,
  filename: string,
  options?: CompileVueFileOptions,
): Promise<VueTransformResult> {
  const jsonKind = options?.json?.kind
    ?? (options?.isApp ? 'app' : options?.isPage ? 'page' : 'component')
  const jsonDefaults = options?.json?.defaults?.[jsonKind]
  const mergeJson = createJsonMerger(options?.json?.mergeStrategy, { filename, kind: jsonKind })

  let scriptSource = source
  let scriptMacroConfig: Record<string, any> | undefined
  let scriptMacroHash: string | undefined
  const scriptLang = path.extname(filename).replace(/^\./, '') || undefined

  try {
    const extracted = await extractJsonMacroFromScriptSetup(source, filename, scriptLang, {
      merge: (target, incoming) => mergeJson(target, incoming, 'macro'),
    })
    scriptSource = extracted.stripped
    scriptMacroConfig = extracted.config
    scriptMacroHash = extracted.macroHash
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    throw new Error(`解析 ${filename} 失败：${message}`)
  }

  const compiledTemplate = compileJsxTemplate(source, filename, options)
  const autoComponentContext = collectJsxAutoComponentContext(source, filename, options?.warn)

  const autoUsingComponentsMap: Record<string, string> = {}
  if (options?.autoUsingComponents?.resolveUsingComponentPath && autoComponentContext.templateTags.size > 0) {
    for (const imported of autoComponentContext.importedComponents) {
      if (!autoComponentContext.templateTags.has(imported.localName)) {
        continue
      }

      let resolved = await options.autoUsingComponents.resolveUsingComponentPath(
        imported.importSource,
        filename,
        {
          localName: imported.localName,
          importedName: imported.importedName,
          kind: imported.kind,
        },
      )

      if (!resolved && imported.importSource.startsWith('/')) {
        resolved = removeExtensionDeep(imported.importSource)
      }
      if (!resolved) {
        continue
      }

      autoUsingComponentsMap[imported.localName] = resolved
    }
  }

  const autoImportTagsMap: Record<string, string> = {}
  if (options?.autoImportTags?.resolveUsingComponent && autoComponentContext.templateTags.size > 0) {
    for (const tag of autoComponentContext.templateTags) {
      if (!isAutoImportCandidateTag(tag)) {
        continue
      }

      let resolved: { name: string, from: string } | undefined
      try {
        resolved = await options.autoImportTags.resolveUsingComponent(tag, filename)
      }
      catch {
        resolved = undefined
      }

      if (!resolved?.from) {
        continue
      }

      autoImportTagsMap[resolved.name || tag] = resolved.from
    }
  }

  const normalizedScriptSource = stripRenderOptionFromScript(scriptSource, filename, options?.warn)
  const transformedScript = transformScript(normalizedScriptSource, {
    skipComponentTransform: options?.isApp,
    isApp: options?.isApp,
    isPage: options?.isPage,
    warn: options?.warn,
    wevuDefaults: options?.wevuDefaults,
    inlineExpressions: compiledTemplate.inlineExpressions,
  })

  if (compiledTemplate.warnings.length && options?.warn) {
    compiledTemplate.warnings.forEach(message => options.warn?.(`[JSX 编译] ${message}`))
  }

  let configObj: Record<string, any> | undefined

  const shouldMergeUsingComponents = Object.keys(autoUsingComponentsMap).length > 0 || Object.keys(autoImportTagsMap).length > 0
  if (shouldMergeUsingComponents) {
    const existingRaw = configObj?.usingComponents
    const usingComponents: Record<string, string> = (existingRaw && typeof existingRaw === 'object' && !Array.isArray(existingRaw))
      ? existingRaw
      : {}

    for (const [name, from] of Object.entries(autoImportTagsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        options?.autoImportTags?.warn?.(
          `[JSX 编译] usingComponents 冲突：${filename} 中 usingComponents['${name}']='${usingComponents[name]}' 将被 JSX 标签自动引入覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    for (const [name, from] of Object.entries(autoUsingComponentsMap)) {
      if (Reflect.has(usingComponents, name) && usingComponents[name] !== from) {
        options?.autoUsingComponents?.warn?.(
          `[JSX 编译] usingComponents 冲突：${filename} 中 usingComponents['${name}']='${usingComponents[name]}' 将被 JSX 导入组件覆盖为 '${from}'`,
        )
      }
      usingComponents[name] = from
    }

    configObj = mergeJson(configObj ?? {}, { usingComponents }, 'auto-using-components')
  }

  if (jsonDefaults && Object.keys(jsonDefaults).length > 0) {
    configObj = mergeJson(configObj ?? {}, jsonDefaults, 'defaults')
  }
  if (scriptMacroConfig && Object.keys(scriptMacroConfig).length > 0) {
    configObj = mergeJson(configObj ?? {}, scriptMacroConfig, 'macro')
  }

  if (options?.isPage) {
    try {
      const enabledFeatures = collectWevuPageFeatureFlags(babelParse(transformedScript.code, BABEL_TS_MODULE_PARSER_OPTIONS))
      configObj = mergePageConfigFromFeatures(configObj, enabledFeatures, { isPage: true })
    }
    catch {
      // 忽略页面特性扫描异常，避免影响主编译流程
    }
  }

  const result: VueTransformResult = {
    script: transformedScript.code,
    template: compiledTemplate.template,
    config: configObj && Object.keys(configObj).length > 0
      ? JSON.stringify(configObj, null, 2)
      : undefined,
    meta: {
      hasScriptSetup: false,
      hasSetupOption: /\bsetup\s*\(/.test(normalizedScriptSource),
      jsonMacroHash: scriptMacroHash,
    },
  }

  return result
}
