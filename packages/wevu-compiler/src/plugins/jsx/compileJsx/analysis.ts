import type { Expression, ObjectExpression } from '@babel/types'
import type { JsxAutoComponentContext, JsxCompileContext, JsxImportedComponent } from './types'
import * as t from '@babel/types'
import { isBuiltinComponent } from '../../../auto-import-components/builtin'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, traverse } from '../../../utils/babel'
import { RESERVED_VUE_COMPONENT_TAGS } from '../../../utils/vueTemplateTags'
import { resolveComponentExpression } from '../../vue/transform/scriptComponent'
import { getObjectPropertyByKey, resolveRenderableExpression } from './ast'

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

/**
 * 单次遍历同时收集导入组件信息和默认导出表达式，避免多次 traverse 开销。
 */
function collectImportsAndExportDefault(ast: t.File) {
  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, ObjectExpression>()
  const imports = new Map<string, JsxImportedComponent>()
  let exportDefaultExpression: Expression | null = null

  traverse(ast, {
    ImportDeclaration(path) {
      const source = path.node.source.value

      // 收集 defineComponent 别名
      if (source === 'wevu' || source === 'vue') {
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

      // 收集导入的组件
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

  return {
    importedComponents: [...imports.values()],
    exportDefaultExpression,
  }
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

export function collectJsxAutoComponentContext(
  source: string,
  filename: string,
  context: JsxCompileContext,
  warn?: (message: string) => void,
): JsxAutoComponentContext {
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

  const { importedComponents, exportDefaultExpression } = collectImportsAndExportDefault(ast)
  if (!exportDefaultExpression) {
    return {
      templateTags: new Set<string>(),
      importedComponents,
    }
  }

  const renderExpression = resolveRenderExpression(exportDefaultExpression, context)
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

/**
 * 从已解析的 AST 中一次性提取 render 表达式和自动组件上下文。
 * 内部只调用一次 collectImportsAndExportDefault，避免重复遍历。
 */
export function analyzeJsxAst(ast: t.File, context: JsxCompileContext) {
  const { importedComponents, exportDefaultExpression } = collectImportsAndExportDefault(ast)

  let renderExpression: Expression | null = null
  let templateTags = new Set<string>()

  if (exportDefaultExpression) {
    renderExpression = resolveRenderExpression(exportDefaultExpression, context)
    if (renderExpression) {
      templateTags = collectJsxTemplateTags(renderExpression)
    }
  }

  return {
    renderExpression,
    autoComponentContext: {
      templateTags,
      importedComponents,
    } as JsxAutoComponentContext,
  }
}
