import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { ObjectExpression, Program } from '@weapp-vite/ast/babelTypes'
import * as t from '@weapp-vite/ast/babelTypes'
import { resolveWevuInternalImportModuleId } from '../../../../../constants'
import { ensureRuntimeImport } from '../../scriptRuntimeImport'
import { resolveSetupFunction } from './setupInitialData'

function resolveImportedLocalName(program: Program, source: string, importedName: string) {
  for (const statement of program.body) {
    if (
      !t.isImportDeclaration(statement)
      || statement.importKind === 'type'
      || statement.source.value !== source
    ) {
      continue
    }
    for (const specifier of statement.specifiers) {
      if (
        t.isImportSpecifier(specifier)
        && specifier.importKind !== 'type'
        && t.isIdentifier(specifier.imported, { name: importedName })
      ) {
        return specifier.local.name
      }
    }
  }
  return undefined
}

function createEmptyCssVarsRegistration(useCssVarsLocalName: string, unrefLocalName: string) {
  return t.expressionStatement(
    t.callExpression(t.identifier(useCssVarsLocalName), [
      t.arrowFunctionExpression([], t.blockStatement([
        t.expressionStatement(
          t.callExpression(t.identifier(unrefLocalName), [t.identifier('undefined')]),
        ),
        t.returnStatement(t.objectExpression([])),
      ])),
    ]),
  )
}

/** 在 setup 同步阶段注册空 CSS 变量结果，保持开发期模块图与导出形状稳定。 */
export function injectStableCssVarsRuntime(
  program: Program,
  componentOptionsObject: ObjectExpression,
  scope: NodePath['scope'],
) {
  const runtimeImportPath = resolveWevuInternalImportModuleId('useCssVars')
  const reactivityImportPath = resolveWevuInternalImportModuleId('unref')
  const useCssVarsLocalName = resolveImportedLocalName(program, runtimeImportPath, 'useCssVars')
    ?? scope.generateUidIdentifier('useCssVars').name
  const unrefLocalName = resolveImportedLocalName(program, reactivityImportPath, 'unref')
    ?? scope.generateUidIdentifier('unref').name
  if (!resolveImportedLocalName(program, runtimeImportPath, 'useCssVars')) {
    ensureRuntimeImport(program, 'useCssVars', useCssVarsLocalName)
  }
  if (!resolveImportedLocalName(program, reactivityImportPath, 'unref')) {
    ensureRuntimeImport(program, 'unref', unrefLocalName)
  }
  const registration = createEmptyCssVarsRegistration(useCssVarsLocalName, unrefLocalName)
  const setupFn = resolveSetupFunction(componentOptionsObject)
  if (setupFn) {
    const body = setupFn.body
    if (t.isBlockStatement(body)) {
      body.body.unshift(registration)
    }
    else {
      setupFn.body = t.blockStatement([
        registration,
        t.returnStatement(body),
      ])
    }
    return true
  }

  componentOptionsObject.properties.push(
    t.objectMethod(
      'method',
      t.identifier('setup'),
      [],
      t.blockStatement([
        registration,
        t.returnStatement(t.objectExpression([])),
      ]),
    ),
  )
  return true
}
