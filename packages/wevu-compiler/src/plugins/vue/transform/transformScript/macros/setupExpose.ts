import type { TransformState } from '../utils'
import * as t from '@babel/types'

export function createSetupExposeVisitors(state: TransformState) {
  return {
    ObjectMethod(path: any) {
      if (!t.isIdentifier(path.node.key, { name: 'setup' }) && !t.isStringLiteral(path.node.key, { value: 'setup' })) {
        return
      }
      const params = path.node.params
      if (params.length < 2 || !t.isObjectPattern(params[1])) {
        return
      }

      // Vue <script setup> 中 defineExpose 会被编译成：
      // setup(__props, { expose: __expose }) { __expose({ ... }) }
      // 这里将内部的 __expose 对齐为 wevu 的 expose（若不冲突）。
      const ctxParam = params[1]
      const hasVueExposeAlias = ctxParam.properties.some((property: t.ObjectProperty | t.RestElement) => {
        if (!t.isObjectProperty(property)) {
          return false
        }
        return (
          t.isIdentifier(property.key, { name: 'expose' })
          && t.isIdentifier(property.value, { name: '__expose' })
        )
      })
      if (hasVueExposeAlias && path.scope.hasBinding('__expose') && !path.scope.hasBinding('expose')) {
        path.scope.rename('__expose', 'expose')
        state.transformed = true

        // 重命名后参数可能变成 `({ expose: expose })`，转成更简洁的 `({ expose })`
        for (const property of ctxParam.properties) {
          if (!t.isObjectProperty(property)) {
            continue
          }
          if (
            t.isIdentifier(property.key, { name: 'expose' })
            && t.isIdentifier(property.value, { name: 'expose' })
          ) {
            property.shorthand = true
          }
        }
      }
    },
  }
}
