import type { TransformState } from '../utils'
import * as t from '@weapp-vite/ast/babelTypes'
import { WE_VU_RUNTIME_APIS } from '../../../../../constants'
import { ensureRuntimeImport } from '../../scriptRuntimeImport'

/**
 * 为 defineAppSetup 宏注入 wevu 运行时导入，允许在 <script setup> 中免导入调用。
 */
export function createAppSetupVisitors(program: t.Program, state: TransformState) {
  return {
    CallExpression(path: any) {
      if (!t.isIdentifier(path.node.callee, { name: WE_VU_RUNTIME_APIS.defineAppSetup })) {
        return
      }

      ensureRuntimeImport(program, WE_VU_RUNTIME_APIS.defineAppSetup)
      state.transformed = true
    },
  }
}
