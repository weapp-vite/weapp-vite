import type { TransformState } from './utils'
import * as t from '@babel/types'
import { WE_VU_RUNTIME_APIS } from '../../../../constants'
import { ensureRuntimeImport } from '../scriptRuntimeImport'

export function createImportVisitors(program: t.Program, state: TransformState) {
  return {
    ImportDeclaration(path: any) {
      // 移除 defineComponent 的导入，同时记录本地别名
      if (path.node.source.value === 'vue') {
        const movedVueRuntimeAPIs = new Set([
          'useAttrs',
          'useSlots',
          'useModel',
          'mergeModels',
          'useTemplateRef',
        ])

        // 将 Vue SFC 编译产物中的部分 Vue runtime API 迁移到 wevu：
        // - defineSlots() => useSlots()
        // - defineModel() => useModel()/mergeModels()
        // - useAttrs()/useSlots()（用户手动导入）
        const movedSpecifiers: Array<{ importedName: string, localName: string }> = []

        const remaining = path.node.specifiers.filter((specifier: t.ImportSpecifier | t.ImportDefaultSpecifier | t.ImportNamespaceSpecifier) => {
          if (t.isImportSpecifier(specifier) && specifier.imported.type === 'Identifier' && specifier.imported.name === WE_VU_RUNTIME_APIS.defineComponent) {
            state.defineComponentAliases.add(specifier.local.name)
            state.transformed = true
            return false
          }

          if (t.isImportSpecifier(specifier) && t.isIdentifier(specifier.imported)) {
            const importedName = specifier.imported.name
            if (movedVueRuntimeAPIs.has(importedName) && t.isIdentifier(specifier.local)) {
              movedSpecifiers.push({ importedName, localName: specifier.local.name })
              state.transformed = true
              return false
            }
          }
          return true
        })

        if (movedSpecifiers.length) {
          for (const { importedName, localName } of movedSpecifiers) {
            ensureRuntimeImport(program, importedName, localName)
          }
        }

        if (remaining.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = remaining
      }

      // 剔除 type-only 导入
      if (path.node.importKind === 'type') {
        state.transformed = true
        path.remove()
        return
      }
      const kept = path.node.specifiers.filter((specifier: any) => {
        if ('importKind' in specifier && specifier.importKind === 'type') {
          state.transformed = true
          return false
        }
        return true
      })
      if (kept.length !== path.node.specifiers.length) {
        if (kept.length === 0) {
          path.remove()
          return
        }
        path.node.specifiers = kept
      }
    },
  }
}
