import type { NodePath } from '@babel/traverse'
import type { File as BabelFile } from '@babel/types'
import type { WevuPageFeatureFlag } from '../../wevu/pageFeatures'
import generateModule from '@babel/generator'
import { parse as babelParse } from '@babel/parser'
import traverseModule from '@babel/traverse'
import * as t from '@babel/types'
import { BABEL_TS_MODULE_PARSER_OPTIONS } from '../../../utils/babel'
import { collectWevuPageFeatureFlags, injectWevuPageFeatureFlagsIntoOptionsObject } from '../../wevu/pageFeatures'
import { RUNTIME_IMPORT_PATH } from './constants'

// 兼容：在 ESM 构建下归一化 CJS default 导出形态（babel generator 可能暴露 { default, generate }）
const generate: typeof generateModule = (generateModule as any).default ?? generateModule
const traverse: typeof traverseModule = (traverseModule as unknown as { default?: typeof traverseModule }).default ?? traverseModule

function isDefineComponentCall(node: t.CallExpression, aliases: Set<string>) {
  return t.isIdentifier(node.callee) && aliases.has(node.callee.name)
}

function unwrapDefineComponent(node: t.Expression, aliases: Set<string>): t.ObjectExpression | null {
  if (t.isCallExpression(node) && isDefineComponentCall(node, aliases)) {
    const arg = node.arguments[0]
    if (t.isObjectExpression(arg)) {
      return arg
    }
  }
  return null
}

function resolveComponentExpression(
  declaration: t.Declaration | t.Expression | null,
  defineComponentDecls: Map<string, t.ObjectExpression>,
  aliases: Set<string>,
): t.Expression | null {
  if (!declaration) {
    return null
  }
  if (t.isObjectExpression(declaration)) {
    return declaration
  }
  if (t.isCallExpression(declaration) && isDefineComponentCall(declaration, aliases)) {
    const arg = declaration.arguments[0]
    if (t.isObjectExpression(arg)) {
      return arg
    }
    if (t.isIdentifier(arg)) {
      const matched = defineComponentDecls.get(arg.name)
      return matched ? t.cloneNode(matched, true) : null
    }
    return null
  }
  if (t.isIdentifier(declaration)) {
    const matched = defineComponentDecls.get(declaration.name)
    return matched ? t.cloneNode(matched, true) : null
  }
  return null
}

function ensureRuntimeImport(program: t.Program, importedName: string) {
  let targetImport = program.body.find(
    node => t.isImportDeclaration(node) && node.source.value === RUNTIME_IMPORT_PATH,
  ) as t.ImportDeclaration | undefined

  if (!targetImport) {
    targetImport = t.importDeclaration(
      [t.importSpecifier(t.identifier(importedName), t.identifier(importedName))],
      t.stringLiteral(RUNTIME_IMPORT_PATH),
    )
    program.body.unshift(targetImport)
    return
  }

  const hasSpecifier = targetImport.specifiers.some(
    spec => t.isImportSpecifier(spec) && spec.imported.type === 'Identifier' && spec.imported.name === importedName,
  )
  if (!hasSpecifier) {
    targetImport.specifiers.push(
      t.importSpecifier(t.identifier(importedName), t.identifier(importedName)),
    )
  }
}

/**
 * 说明：Vue SFC 编译后处理插件
 * 修复 Vue SFC 编译器生成的代码中的问题：
 * 1. 移除从 'vue' 导入 defineComponent
 * 2. 修复 expose 参数语法错误
 * 3. 移除 __name 属性
 * 4. 移除 __expose() 调用
 */
function vueSfcTransformPlugin() {
  return {
    name: 'vue-sfc-transform',
    visitor: {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
        // 移除 import { defineComponent } from 'vue'
        const source = path.node.source.value
        if (source === 'vue') {
          const specifiers = path.node.specifiers
          const filteredSpecifiers = specifiers.filter((s) => {
            if (s.type === 'ImportSpecifier' && t.isIdentifier(s.imported) && s.imported.name === 'defineComponent') {
              return false
            }
            return true
          })
          if (filteredSpecifiers.length === 0) {
            path.remove()
          }
          else if (filteredSpecifiers.length !== specifiers.length) {
            path.node.specifiers = filteredSpecifiers
          }
        }
      },

      ObjectExpression(path: NodePath<t.ObjectExpression>) {
        // 移除 __name 属性
        const properties = path.node.properties
        const filtered = properties.filter((p) => {
          if (p.type === 'ObjectProperty') {
            const key = p.key
            if (key.type === 'Identifier' && key.name === '__name') {
              return false
            }
          }
          return true
        })
        path.node.properties = filtered
      },

      CallExpression(path: NodePath<t.CallExpression>) {
        // 移除 __expose() 调用
        if (path.node.callee.type === 'Identifier' && path.node.callee.name === '__expose') {
          path.remove()
        }
      },
    },
  }
}

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
  if (options?.templateComponentMeta && Object.keys(options.templateComponentMeta).length) {
    const metaMap = options.templateComponentMeta
    const candidateNames = new Set(Object.keys(metaMap))
    const injectedNames = new Set<string>()

    traverse(ast, {
      ImportDeclaration(path) {
        if (!path.node.specifiers.length) {
          return
        }
        const kept = path.node.specifiers.filter((specifier) => {
          if (!('local' in specifier) || !t.isIdentifier(specifier.local)) {
            return true
          }
          const localName = specifier.local.name
          return !candidateNames.has(localName)
        })

        if (kept.length !== path.node.specifiers.length) {
          transformed = true
          if (kept.length === 0) {
            path.remove()
            return
          }
          path.node.specifiers = kept
        }
      },
    })

    const decls: t.Statement[] = []
    for (const name of Object.keys(metaMap)) {
      if (injectedNames.has(name)) {
        continue
      }
      injectedNames.add(name)
      decls.push(
        t.variableDeclaration('const', [
          t.variableDeclarator(
            t.identifier(name),
            t.objectExpression([
              t.objectProperty(t.identifier('__weappViteUsingComponent'), t.booleanLiteral(true)),
              t.objectProperty(t.identifier('name'), t.stringLiteral(name)),
              t.objectProperty(t.identifier('from'), t.stringLiteral(metaMap[name])),
            ]),
          ),
        ]),
      )
    }

    if (decls.length) {
      const body = ast.program.body
      let insertAt = 0
      while (insertAt < body.length && t.isImportDeclaration(body[insertAt])) {
        insertAt += 1
      }
      body.splice(insertAt, 0, ...decls)
      transformed = true
    }
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
