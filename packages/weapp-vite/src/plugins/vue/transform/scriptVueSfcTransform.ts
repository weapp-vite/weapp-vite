import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'
import { WE_VU_RUNTIME_APIS } from 'wevu/compiler'

/**
 * 说明：Vue SFC 编译后处理插件
 * 修复 Vue SFC 编译器生成的代码中的问题：
 * 1. 移除从 'vue' 导入 defineComponent
 * 2. 移除 __name 属性
 * 3. 移除空参数的 __expose() 调用（保留 defineExpose 生成的 __expose({...})）
 */
export function vueSfcTransformPlugin() {
  return {
    name: 'vue-sfc-transform',
    visitor: {
      ImportDeclaration(path: NodePath<t.ImportDeclaration>) {
        // 移除 import { defineComponent } from 'vue'
        const source = path.node.source.value
        if (source === 'vue') {
          const specifiers = path.node.specifiers
          const filteredSpecifiers = specifiers.filter((s) => {
            if (s.type === 'ImportSpecifier' && t.isIdentifier(s.imported) && s.imported.name === WE_VU_RUNTIME_APIS.defineComponent) {
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
        // 移除 __expose() 调用（仅空参数；有参数时为 defineExpose 的产物，需要保留）
        if (
          t.isIdentifier(path.node.callee, { name: '__expose' })
          && path.parentPath?.isExpressionStatement()
          && path.node.arguments.length === 0
        ) {
          path.parentPath.remove()
        }
      },
    },
  }
}
