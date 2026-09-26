import type { NodePath } from '@weapp-vite/ast/babelTraverse'
import type { File } from '@weapp-vite/ast/babelTypes'
import type { TransformState } from '../utils'
import { WEVU_DEFINE_PAGE_META_MACRO } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { WE_VU_MODULE_ID } from '../../../../../constants'
import { collectPageMetaCallsForTransform } from '../../../../../pageDeclaration/analyze'

function importedName(specifier: t.ImportSpecifier) {
  return t.isIdentifier(specifier.imported)
    ? specifier.imported.name
    : specifier.imported.value
}

/**
 * 移除页面元信息宏及其规范导入，避免其进入运行时脚本。
 */
export function createPageMetaVisitors(ast: File, state: TransformState) {
  const macroCalls = new Set(collectPageMetaCallsForTransform(ast))
  return {
    ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
      if (path.node.source.value !== WE_VU_MODULE_ID || path.node.importKind === 'type') {
        return
      }
      const remaining = path.node.specifiers.filter((specifier: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier) => {
        return !t.isImportSpecifier(specifier)
          || specifier.importKind === 'type'
          || importedName(specifier) !== WEVU_DEFINE_PAGE_META_MACRO
      })
      if (remaining.length === path.node.specifiers.length) {
        return
      }
      state.transformed = true
      if (!remaining.length) {
        path.remove()
        return
      }
      path.node.specifiers = remaining
    },
    CallExpression(path: NodePath<t.CallExpression>) {
      if (!macroCalls.has(path.node) || !path.parentPath?.isExpressionStatement()) {
        return
      }
      path.parentPath.remove()
      state.transformed = true
    },
  }
}
