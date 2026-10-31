import type babelPresetEnv from '@babel/preset-env'
import type babelPresetTypescript from '@babel/preset-typescript'
import type { MpPlatform } from '@weapp-core/shared'
import { createRequire } from 'node:module'
import { getMiniProgramScriptModuleOptions } from '@weapp-core/shared'
import * as babel from '@weapp-vite/ast/babelCore'
import * as t from '@weapp-vite/ast/babelTypes'
import { collectWxsDependencies } from './dependencies'
import { isDefaultExportSpecifier, runtimeExportShape } from './moduleExports'
import { normalizeWxsFilename } from './utils'

type BabelPluginItem = NonNullable<babel.TransformOptions['plugins']>[number]
type BabelPresetItem = NonNullable<babel.TransformOptions['presets']>[number]

const nodeRequire = createRequire(import.meta.url)
let babelPresets: { env: typeof babelPresetEnv, typescript: typeof babelPresetTypescript } | undefined

/** 首次转换才加载 presets，兼容 Babel 的 ESM default 与 CommonJS 导出。 */
function loadBabelPreset<T>(name: string): T {
  const loaded = nodeRequire(name) as T & { default?: T }
  return loaded.default ?? loaded
}

function getBabelPresets() {
  return babelPresets ??= {
    env: loadBabelPreset<typeof babelPresetEnv>('@babel/preset-env'),
    typescript: loadBabelPreset<typeof babelPresetTypescript>('@babel/preset-typescript'),
  }
}

export interface TransformWxsCodeOptions {
  filename?: string
  extension?: string
  platform?: MpPlatform
}

export interface TransformWxsCodeResult {
  result: ReturnType<typeof babel.transformSync>
  importees: Array<{ source: string }>
}

export {
  normalizeWxsFilename,
}

export function transformWxsCode(code: string, options?: TransformWxsCodeOptions): TransformWxsCodeResult {
  const presets = getBabelPresets()
  const filename = options?.filename ?? 'script.ts'
  const extension = options?.extension ?? 'wxs'
  const preserveEsmExports = getMiniProgramScriptModuleOptions(options?.platform, extension).format === 'esm'
  const importees: Array<{ source: string }> = []
  let flattenDefault = true
  let preserveInteropMarker = false

  const result = babel.transformSync(code, {
    babelrc: false,
    configFile: false,
    presets: [
      [presets.env, { modules: preserveEsmExports ? false : 'commonjs', targets: { ie: '11' } }] as BabelPresetItem,
      presets.typescript as BabelPresetItem,
    ],
    filename,
    plugins: [
      {
        visitor: {
          Program: {
            enter(p: babel.NodePath<t.Program>) {
              importees.push(...collectWxsDependencies(p))
              const shape = runtimeExportShape(p)
              flattenDefault = !shape.named
              preserveInteropMarker = shape.named && shape.defaultExport
            },
          },
          Directive: {
            enter(p: babel.NodePath<t.Directive>) {
              p.remove()
            },
          },
          CallExpression: {
            enter(p: babel.NodePath<t.CallExpression>) {
              const node = p.node
              if (!t.isIdentifier(node.callee, { name: 'require' }) || p.scope.getBinding('require')) {
                return
              }
              if (node.arguments.length !== 1) {
                return
              }

              const arg = node.arguments[0]
              if (t.isStringLiteral(arg)) {
                arg.value = normalizeWxsFilename(arg.value, extension)
              }
              // 待办：模板字符串
            },
          },
          ExpressionStatement(p: babel.NodePath<t.ExpressionStatement>) {
            const expression = p.node.expression

            if (
              expression.type === 'CallExpression'
              && expression.callee.type === 'MemberExpression'
              && t.isIdentifier(expression.callee.object)
              && expression.callee.object.name === 'Object'
              && t.isIdentifier(expression.callee.property)
              && expression.callee.property.name === 'defineProperty'
              && expression.arguments.length >= 2
              && t.isIdentifier(expression.arguments[0])
              && expression.arguments[0].name === 'exports'
              && t.isStringLiteral(expression.arguments[1])
              && expression.arguments[1].value === '__esModule'
              && !p.scope.getBinding('exports')
            ) {
              if (!preserveInteropMarker) {
                p.remove()
              }
              else {
                p.replaceWith(t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.memberExpression(t.identifier('module'), t.identifier('exports')), t.identifier('__esModule')), t.booleanLiteral(true))))
              }
            }
          },
          AssignmentExpression: {
            enter(p: babel.NodePath<t.AssignmentExpression>) {
              if (!preserveEsmExports || p.node.operator !== '=') {
                return
              }

              const left = p.node.left
              if (
                !t.isMemberExpression(left)
                || left.computed
                || !t.isIdentifier(left.object, { name: 'module' })
                || !t.isIdentifier(left.property, { name: 'exports' })
                || p.scope.getBinding('module')
                || !p.parentPath.isExpressionStatement()
              ) {
                return
              }

              p.parentPath.replaceWith(t.exportDefaultDeclaration(p.node.right))
            },
          },
          NewExpression: {
            enter(p: babel.NodePath<t.NewExpression>) {
              const node = p.node
              if (t.isIdentifier(node.callee, { name: 'RegExp' }) && !p.scope.getBinding('RegExp')) {
                p.replaceWith(
                  t.callExpression(
                    t.identifier('getRegExp'),
                    node.arguments as any,
                  ),
                )
              }
              else if (t.isIdentifier(node.callee, { name: 'Date' }) && !p.scope.getBinding('Date')) {
                p.replaceWith(
                  t.callExpression(
                    t.identifier('getDate'),
                    node.arguments as any,
                  ),
                )
              }
            },
          },
          RegExpLiteral: {
            enter(p: babel.NodePath<t.RegExpLiteral>) {
              const args = [t.stringLiteral(p.node.pattern)]
              if (p.node.flags) {
                args.push(t.stringLiteral(p.node.flags))
              }
              p.replaceWith(
                t.callExpression(t.identifier('getRegExp'), args),
              )
            },
          },
          MemberExpression: {
            enter(p: babel.NodePath<t.MemberExpression>) {
              if (preserveEsmExports) {
                return
              }
              const node = p.node
              if (!t.isIdentifier(node.object, { name: 'exports' }) || p.scope.getBinding('exports')) {
                return
              }
              const moduleExports = t.memberExpression(t.identifier('module'), t.identifier('exports'))
              p.replaceWith(
                t.memberExpression(
                  moduleExports,
                  node.property as any,
                  node.computed,
                ),
              )
            },
          },
          ImportDeclaration: {
            enter(p: babel.NodePath<t.ImportDeclaration>) {
              p.node.source.value = normalizeWxsFilename(p.node.source.value, extension)
            },
          },
          ExportAllDeclaration: {
            enter(p: babel.NodePath<t.ExportAllDeclaration>) {
              if (p.node.source) {
                p.node.source.value = normalizeWxsFilename(p.node.source.value, extension)
              }
            },
          },
          ExportNamedDeclaration: {
            enter(p: babel.NodePath<t.ExportNamedDeclaration>) {
              if (p.node.source) {
                p.node.source.value = normalizeWxsFilename(p.node.source.value, extension)
              }
              const specifier = p.node.specifiers.find(isDefaultExportSpecifier)
              if (preserveEsmExports || !flattenDefault || !specifier) {
                return
              }
              let value: t.Expression
              const declarations: t.Statement[] = []
              if (p.node.source) {
                const local = p.scope.generateUidIdentifier('defaultExport')
                const imported = t.isExportNamespaceSpecifier(specifier) ? t.importNamespaceSpecifier(local) : t.isExportSpecifier(specifier) && !t.isIdentifier(specifier.local, { name: 'default' }) ? t.importSpecifier(local, specifier.local) : t.importDefaultSpecifier(local)
                declarations.push(t.importDeclaration([imported], p.node.source))
                value = local
              }
              else if (t.isExportSpecifier(specifier) && t.isIdentifier(specifier.local)) {
                value = specifier.local
              }
              else {
                return
              }
              declarations.push(t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('module'), t.identifier('exports')), value)))
              p.node.specifiers = p.node.specifiers.filter(candidate => candidate !== specifier)
              p.replaceWithMultiple(p.node.specifiers.length ? [...declarations, p.node] : declarations)
            },
          },
          ExportDefaultDeclaration: {
            enter(p: babel.NodePath<t.ExportDefaultDeclaration>) {
              if (preserveEsmExports || !flattenDefault) {
                return
              }
              const declaration = p.node.declaration
              if (t.isTSInterfaceDeclaration(declaration) || t.isTSDeclareFunction(declaration)) {
                return
              }
              const named = (t.isFunctionDeclaration(declaration) || t.isClassDeclaration(declaration)) && declaration.id
              const exported = named ? t.identifier(named.name) : t.isFunctionDeclaration(declaration) ? t.toExpression(declaration) : t.isClassDeclaration(declaration) ? t.toExpression(declaration) : t.isExpression(declaration) ? declaration : undefined
              if (!exported) {
                return
              }
              const assignment = t.expressionStatement(t.assignmentExpression('=', t.memberExpression(t.identifier('module'), t.identifier('exports')), exported))
              if (named) {
                p.replaceWithMultiple([declaration, assignment])
              }
              else {
                p.replaceWith(assignment)
              }
            },
          },

        },
      } as unknown as BabelPluginItem,
    ],
  })

  return {
    result,
    importees,
  }
}
