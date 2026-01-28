import type { TransformState } from './utils'
import * as t from '@babel/types'
import { unwrapDefineComponent } from '../scriptComponent'

export function createCollectVisitors(state: TransformState) {
  return {
    VariableDeclarator(path: any) {
      if (!t.isIdentifier(path.node.id) || !path.node.init) {
        return
      }
      if (t.isObjectExpression(path.node.init)) {
        state.defineComponentDecls.set(path.node.id.name, t.cloneNode(path.node.init, true))
      }
      const unwrapped = unwrapDefineComponent(path.node.init, state.defineComponentAliases)
      if (unwrapped) {
        state.defineComponentDecls.set(path.node.id.name, t.cloneNode(unwrapped, true))
        path.node.init = unwrapped
        state.transformed = true
      }
    },

    ExportDefaultDeclaration(path: any) {
      state.defaultExportPath = path
    },
  }
}
