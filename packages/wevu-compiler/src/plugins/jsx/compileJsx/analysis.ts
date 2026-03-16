import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { AstEngineName } from '../../../ast/types'
import type { JsxAutoComponentContext, JsxCompileContext } from './types'
import {
  collectJsxImportedComponentsAndDefaultExportFromBabelAst,
  collectJsxTemplateTagsFromBabelExpression,
  getRenderPropertyFromComponentOptions,
  resolveRenderExpressionFromComponentOptions,
} from '@weapp-vite/ast'
import * as t from '@weapp-vite/ast/babelTypes'
import { collectJsxAutoComponentsFromCode } from '../../../ast/operations/jsxAutoComponents'
import { isBuiltinComponent } from '../../../auto-import-components/builtin'
import { RESERVED_VUE_COMPONENT_TAGS } from '../../../utils/vueTemplateTags'
import { resolveComponentExpression } from '../../vue/transform/scriptComponent'

function resolveRenderExpression(componentExpr: Expression, context: JsxCompileContext): Expression | null {
  if (!t.isObjectExpression(componentExpr)) {
    context.warnings.push('JSX 编译仅支持对象字面量组件选项。')
    return null
  }

  const renderExpression = resolveRenderExpressionFromComponentOptions(componentExpr)
  if (!renderExpression) {
    if (!getRenderPropertyFromComponentOptions(componentExpr)) {
      context.warnings.push('未找到 render()，请在默认导出组件中声明 render 函数。')
      return null
    }
    context.warnings.push('render 不是可执行函数。')
    return null
  }

  return renderExpression
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
      templateTags = collectJsxTemplateTagsFromBabelExpression(renderExpression, isCollectableJsxTemplateTag)
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
