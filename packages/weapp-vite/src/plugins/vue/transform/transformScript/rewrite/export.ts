import type { File as BabelFile } from '@babel/types'
import * as t from '@babel/types'
import { WE_VU_RUNTIME_APIS } from 'wevu/compiler'
import { ensureRuntimeImport } from '../../scriptRuntimeImport'

export function rewriteComponentExport(params: {
  ast: BabelFile
  exportPath: any
  componentExpr: t.Expression
  isAppFile: boolean
  skipComponentTransform: boolean | undefined
}) {
  const { ast, exportPath, componentExpr, isAppFile, skipComponentTransform } = params
  const DEFAULT_OPTIONS_IDENTIFIER = '__wevuOptions'

  if (isAppFile) {
    ensureRuntimeImport(ast.program, WE_VU_RUNTIME_APIS.createApp)
    exportPath.replaceWith(
      t.expressionStatement(
        t.callExpression(t.identifier(WE_VU_RUNTIME_APIS.createApp), [
          componentExpr,
        ]),
      ),
    )
    return true
  }

  if (skipComponentTransform) {
    exportPath.replaceWith(t.exportDefaultDeclaration(componentExpr))
    return true
  }

  ensureRuntimeImport(ast.program, WE_VU_RUNTIME_APIS.createWevuComponent)
  exportPath.replaceWith(
    t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(DEFAULT_OPTIONS_IDENTIFIER), componentExpr),
    ]),
  )
  exportPath.insertAfter(
    t.expressionStatement(
      t.callExpression(t.identifier(WE_VU_RUNTIME_APIS.createWevuComponent), [
        t.identifier(DEFAULT_OPTIONS_IDENTIFIER),
      ]),
    ),
  )
  return true
}
