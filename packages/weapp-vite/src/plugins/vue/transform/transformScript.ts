import type { NodePath } from '@babel/traverse'
import type { File as BabelFile } from '@babel/types'
import type { WevuPageFeatureFlag } from '../../wevu/pageFeatures'
import { parse as babelParse } from '@babel/parser'
import * as t from '@babel/types'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../../../utils/babel'
import { collectWevuPageFeatureFlags, injectWevuPageFeatureFlagsIntoOptionsObject } from '../../wevu/pageFeatures'
import { generate, traverse } from './babel'
import { resolveComponentExpression, unwrapDefineComponent } from './scriptComponent'
import { ensureRuntimeImport } from './scriptRuntimeImport'
import { injectTemplateComponentMeta } from './scriptTemplateMeta'
import { vueSfcTransformPlugin } from './scriptVueSfcTransform'

/**
 * 使用 Babel AST 转换脚本
 * 比正则替换更健壮，能处理复杂的代码结构
 */
export interface TransformResult {
  code: string
  transformed: boolean
}

export interface TransformScriptOptions {
  /**
   * 是否跳过组件转换（不添加 createWevuComponent 调用）
   * 用于 app.vue 等入口文件
   */
  skipComponentTransform?: boolean
  /**
   * 是否是 Page 入口（仅 Page 才需要注入 features 以启用按需派发的页面事件）
   */
  isPage?: boolean
  /**
   * <script setup> 中引入的组件：编译时移除 import，并提供同名元信息对象占位，避免运行时访问时报错。
   * key: 组件别名（需与模板标签一致），value: usingComponents 的 from（如 `/components/foo/index`）
   */
  templateComponentMeta?: Record<string, string>
}

export function transformScript(source: string, options?: TransformScriptOptions): TransformResult {
  const ast: BabelFile = babelParse(source, BABEL_TS_MODULE_PARSER_OPTIONS)

  const defineComponentAliases = new Set<string>(['defineComponent', '_defineComponent'])
  const defineComponentDecls = new Map<string, t.ObjectExpression>()
  let defaultExportPath: NodePath<t.ExportDefaultDeclaration> | null = null
  let transformed = false

  const DEFAULT_OPTIONS_IDENTIFIER = '__wevuOptions'
  const enabledPageFeatures: Set<WevuPageFeatureFlag> = options?.isPage
    ? collectWevuPageFeatureFlags(ast)
    : new Set<WevuPageFeatureFlag>()

  // 先运行 Vue SFC 转换插件
  traverse(ast, vueSfcTransformPlugin().visitor as any)

  traverse(ast, {
    ImportDeclaration(path) {
      // 移除 defineComponent 的导入，同时记录本地别名
      if (path.node.source.value === 'vue') {
        const remaining = path.node.specifiers.filter((specifier) => {
          if (t.isImportSpecifier(specifier) && specifier.imported.type === 'Identifier' && specifier.imported.name === 'defineComponent') {
            defineComponentAliases.add(specifier.local.name)
            transformed = true
            return false
          }
          return true
        })
        if (remaining.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = remaining
      }

      // 剔除 type-only 导入
      if (path.node.importKind === 'type') {
        transformed = true
        path.remove()
        return
      }
      const kept = path.node.specifiers.filter((specifier) => {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          transformed = true
          return false
        }
        return true
      })
      if (kept.length !== path.node.specifiers.length) {
        if (kept.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = kept
      }
    },

    ExportNamedDeclaration(path) {
      if (path.node.exportKind === 'type') {
        transformed = true
        path.remove()
        return
      }
      if (path.node.specifiers?.length) {
        const remaining = path.node.specifiers.filter((spec) => {
          if (t.isExportSpecifier(spec)) {
            return spec.exportKind !== 'type'
          }
          return true
        })
        if (remaining.length !== path.node.specifiers.length) {
          transformed = true
          if (remaining.length === 0) {
            path.remove()
            return
          }
          path.node.specifiers = remaining
        }
      }
    },

    VariableDeclarator(path) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(path.node.init, true))
      }
      const unwrapped = unwrapDefineComponent(path.node.init, defineComponentAliases)
      if (unwrapped) {
        defineComponentDecls.set(path.node.id.name, t.cloneNode(unwrapped, true))
        path.node.init = unwrapped
        transformed = true
      }
    },

    ExportDefaultDeclaration(path) {
      defaultExportPath = path
    },

    CallExpression(path) {
      // 移除 __expose() 调用
      if (t.isIdentifier(path.node.callee, { name: '__expose' }) && path.parentPath?.isExpressionStatement()) {
        path.parentPath.remove()
        transformed = true
        return
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    NewExpression(path) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    ObjectProperty(path) {
      if (
        t.isIdentifier(path.node.key, { name: '__name' })
        || t.isStringLiteral(path.node.key, { value: '__name' })
      ) {
        path.remove()
        transformed = true
      }
    },

    TSTypeAliasDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSInterfaceDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSEnumDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSModuleDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSImportEqualsDeclaration(path) {
      path.remove()
      transformed = true
    },

    TSAsExpression(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSTypeAssertion(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSNonNullExpression(path) {
      path.replaceWith(path.node.expression)
      transformed = true
    },

    TSTypeAnnotation(path) {
      path.remove()
      transformed = true
    },

    TSParameterProperty(path) {
      path.replaceWith(path.node.parameter as t.Identifier | t.Pattern)
      transformed = true
    },

    Function(path) {
      if (path.node.returnType) {
        path.node.returnType = null
        transformed = true
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        transformed = true
      }
    },

    ClassProperty(path) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        transformed = true
      }
    },

    ClassPrivateProperty(path) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        transformed = true
      }
    },
  })

  // <script setup> 组件导入自动注册：移除 import，并注入元信息对象（满足用户在 script 中访问/打印的需求）
  if (options?.templateComponentMeta) {
    transformed = injectTemplateComponentMeta(ast, options.templateComponentMeta) || transformed
  }

  // 处理 export default，注入 createWevuComponent 调用或直接解包 defineComponent
  if (defaultExportPath) {
    const exportPath = defaultExportPath as NodePath<t.ExportDefaultDeclaration>
    const componentExpr = resolveComponentExpression(
      exportPath.node.declaration,
      defineComponentDecls,
      defineComponentAliases,
    )

    if (componentExpr && t.isObjectExpression(componentExpr) && enabledPageFeatures.size) {
      transformed = injectWevuPageFeatureFlagsIntoOptionsObject(componentExpr, enabledPageFeatures) || transformed
    }

    if (componentExpr && options?.skipComponentTransform) {
      exportPath.replaceWith(t.exportDefaultDeclaration(componentExpr))
      transformed = true
    }
    else if (componentExpr) {
      ensureRuntimeImport(ast.program, 'createWevuComponent')
      exportPath.replaceWith(
        t.variableDeclaration('const', [
          t.variableDeclarator(t.identifier(DEFAULT_OPTIONS_IDENTIFIER), componentExpr),
        ]),
      )
      exportPath.insertAfter(
        t.expressionStatement(
          t.callExpression(t.identifier('createWevuComponent'), [
            t.identifier(DEFAULT_OPTIONS_IDENTIFIER),
          ]),
        ),
      )
      transformed = true
    }
  }

  if (!transformed) {
    return {
      code: source,
      transformed: false,
    }
  }

  const generated = generate(ast, {
    retainLines: true,
  })

  return {
    code: generated.code,
    transformed,
  }
}
