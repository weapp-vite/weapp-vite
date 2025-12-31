import type { NodePath } from '@babel/traverse'
import * as t from '@babel/types'

/**
 * 说明：Vue SFC 编译后处理插件
 * 修复 Vue SFC 编译器生成的代码中的问题：
 * 1. 移除从 'vue' 导入 defineComponent
 * 2. 修复 expose 参数语法错误
 * 3. 移除 __name 属性
 * 4. 移除 __expose() 调用
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
