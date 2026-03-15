import type { Expression } from '@babel/types'
import type { AstEngineName } from '../../../ast/types'
import type { JsxAutoComponentContext, JsxCompileContext } from './types'
import * as t from '@babel/types'
import { collectJsxImportedComponentsAndDefaultExportFromBabelAst } from '@weapp-vite/ast'
import { collectJsxAutoComponentsFromCode } from '../../../ast/operations/jsxAutoComponents'
import { isBuiltinComponent } from '../../../auto-import-components/builtin'
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

function isCollectableJsxTemplateTag(tag: string) {
  if (!tag) {
    return false
  }
  if (RESERVED_VUE_COMPONENT_TAGS.has(tag)) {
    return false
  }
  return !isBuiltinComponent(tag)
}

/**
 * 递归收集 JSX 表达式中的自定义组件标签名。
 * 直接遍历 AST 节点，无需 cloneNode 和 Babel traverse。
 */
function collectJsxTemplateTags(renderExpression: Expression) {
  const tags = new Set<string>()

  function walk(node: t.Node) {
    if (t.isJSXElement(node)) {
      const { name } = node.openingElement
      if (!t.isJSXMemberExpression(name)) {
        let tag: string | null = null
        if (t.isJSXIdentifier(name)) {
          tag = name.name
        }
        else if (t.isJSXNamespacedName(name)) {
          tag = `${name.namespace.name}:${name.name.name}`
        }
        if (tag && isCollectableJsxTemplateTag(tag)) {
          tags.add(tag)
        }
      }
      for (const child of node.children) {
        walk(child)
      }
      return
    }
    if (t.isJSXFragment(node)) {
      for (const child of node.children) {
        walk(child)
      }
      return
    }
    if (t.isJSXExpressionContainer(node) && !t.isJSXEmptyExpression(node.expression)) {
      walk(node.expression)
      return
    }
    if (t.isConditionalExpression(node)) {
      walk(node.consequent)
      walk(node.alternate)
      return
    }
    if (t.isLogicalExpression(node)) {
      walk(node.left)
      walk(node.right)
      return
    }
    if (t.isCallExpression(node)) {
      for (const arg of node.arguments) {
        if (t.isExpression(arg)) {
          walk(arg)
        }
      }
      return
    }
    if (t.isArrowFunctionExpression(node) || t.isFunctionExpression(node)) {
      if (t.isBlockStatement(node.body)) {
        for (const stmt of node.body.body) {
          if (t.isReturnStatement(stmt) && stmt.argument) {
            walk(stmt.argument)
          }
        }
      }
      else {
        walk(node.body)
      }
      return
    }
    if (t.isArrayExpression(node)) {
      for (const element of node.elements) {
        if (element && t.isExpression(element)) {
          walk(element)
        }
      }
      return
    }
    if (t.isParenthesizedExpression(node) || t.isTSAsExpression(node) || t.isTSSatisfiesExpression(node) || t.isTSNonNullExpression(node)) {
      walk((node as t.ParenthesizedExpression).expression)
    }
  }

  walk(renderExpression)
  return tags
}

export function collectJsxAutoComponentContext(
  source: string,
  filename: string,
  _context: JsxCompileContext,
  options?: {
    astEngine?: AstEngineName
    warn?: (message: string) => void
  },
): JsxAutoComponentContext {
  const empty: JsxAutoComponentContext = {
    templateTags: new Set<string>(),
    importedComponents: [],
  }

  // 这里先统一调用入口，后续再按 `astEngine` 拆分真正的 Oxc 分析后端。
  const warn = options?.warn

  try {
    const collected = collectJsxAutoComponentsFromCode(source, {
      astEngine: options?.astEngine,
    })

    // 保留现有警告语义：只有在完整 render 编译链下才发出组件选项/缺失 render 警告，
    // 自动组件收集本身仅返回可推导结果。
    if (options?.astEngine === 'oxc') {
      return collected
    }

    return collected
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    warn?.(`[JSX 编译] 解析 ${filename} 失败，已跳过自动 usingComponents 推导：${message}`)
    return empty
  }
}

/**
 * 从已解析的 AST 中一次性提取 render 表达式和自动组件上下文。
 * 内部只调用一次 collectImportsAndExportDefault，避免重复遍历。
 */
export function analyzeJsxAst(ast: t.File, context: JsxCompileContext) {
  const { importedComponents, exportDefaultExpression } = collectJsxImportedComponentsAndDefaultExportFromBabelAst(ast, {
    isDefineComponentSource(source) {
      return source === 'wevu' || source === 'vue'
    },
    resolveBabelComponentExpression: resolveComponentExpression,
  })

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
