import type { TransformState } from '../utils'
import * as t from '@weapp-vite/ast/babelTypes'
import { PAGE_META_MACRO_NAME } from '../utils'

/**
 * 移除页面元信息宏，避免其进入运行时脚本。
 */
export function createPageMetaVisitors(state: TransformState) {
  return {
    CallExpression(path: any) {
      if (!t.isIdentifier(path.node.callee, { name: PAGE_META_MACRO_NAME })) {
        return
      }
      if (!path.parentPath?.isExpressionStatement() || !path.parentPath.parentPath?.isProgram()) {
        return
      }
      path.parentPath.remove()
      state.transformed = true
    },
  }
}
