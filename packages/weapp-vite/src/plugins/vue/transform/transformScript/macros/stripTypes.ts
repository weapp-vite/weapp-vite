import type { TransformState } from '../utils'
import * as t from '@babel/types'
import { stripOptionalFlag, stripOptionalFromPattern } from './optional'

export function createStripTypesVisitors(state: TransformState) {
  return {
    ExportNamedDeclaration(path: any) {
      if (path.node.exportKind === 'type') {
        state.transformed = true
        path.remove()
        return
      }
      if (path.node.specifiers?.length) {
        const remaining = path.node.specifiers.filter((spec: any) => {
          if (t.isExportSpecifier(spec)) {
            return spec.exportKind !== 'type'
          }
          return true
        })
        if (remaining.length !== path.node.specifiers.length) {
          state.transformed = true
          if (remaining.length === 0) {
            path.remove()
            return
          }
          path.node.specifiers = remaining
        }
      }
    },

    CallExpression(path: any) {
      // 移除 __expose() 调用
      if (t.isIdentifier(path.node.callee, { name: '__expose' }) && path.parentPath?.isExpressionStatement()) {
        // 空参数时是 Vue 编译器注入的默认暴露调用；有参数时为 defineExpose 产物，需要保留。
        if (path.node.arguments.length === 0) {
          path.parentPath.remove()
          state.transformed = true
          return
        }
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        state.transformed = true
      }
    },

    NewExpression(path: any) {
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        state.transformed = true
      }
    },

    ObjectProperty(path: any) {
      if (
        t.isIdentifier(path.node.key, { name: '__name' })
        || t.isStringLiteral(path.node.key, { value: '__name' })
      ) {
        path.remove()
        state.transformed = true
      }
    },

    TSTypeAliasDeclaration(path: any) {
      path.remove()
      state.transformed = true
    },

    TSInterfaceDeclaration(path: any) {
      path.remove()
      state.transformed = true
    },

    TSEnumDeclaration(path: any) {
      path.remove()
      state.transformed = true
    },

    TSModuleDeclaration(path: any) {
      path.remove()
      state.transformed = true
    },

    TSImportEqualsDeclaration(path: any) {
      path.remove()
      state.transformed = true
    },

    TSAsExpression(path: any) {
      path.replaceWith(path.node.expression)
      state.transformed = true
    },

    TSSatisfiesExpression(path: any) {
      path.replaceWith(path.node.expression)
      state.transformed = true
    },

    TSTypeAssertion(path: any) {
      path.replaceWith(path.node.expression)
      state.transformed = true
    },

    TSNonNullExpression(path: any) {
      path.replaceWith(path.node.expression)
      state.transformed = true
    },

    TSTypeAnnotation(path: any) {
      path.remove()
      state.transformed = true
    },

    TSParameterProperty(path: any) {
      path.replaceWith(path.node.parameter)
      state.transformed = true
    },

    Function(path: any) {
      if (path.node.returnType) {
        path.node.returnType = null
        state.transformed = true
      }
      if (path.node.typeParameters) {
        path.node.typeParameters = null
        state.transformed = true
      }
      for (const param of path.node.params) {
        if (stripOptionalFromPattern(param)) {
          state.transformed = true
        }
      }
    },

    ClassMethod(path: any) {
      if (stripOptionalFlag(path.node)) {
        state.transformed = true
      }
    },

    ClassPrivateMethod(path: any) {
      if (stripOptionalFlag(path.node)) {
        state.transformed = true
      }
    },

    ClassAccessorProperty(path: any) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        state.transformed = true
      }
      if (stripOptionalFlag(path.node)) {
        state.transformed = true
      }
    },

    ClassProperty(path: any) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        state.transformed = true
      }
      if (stripOptionalFlag(path.node)) {
        state.transformed = true
      }
    },

    ClassPrivateProperty(path: any) {
      if (path.node.typeAnnotation) {
        path.node.typeAnnotation = null
        state.transformed = true
      }
      if (stripOptionalFlag(path.node)) {
        state.transformed = true
      }
    },
  }
}
