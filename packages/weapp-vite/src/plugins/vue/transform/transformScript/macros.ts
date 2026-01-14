import type { TransformState } from './utils'
import * as t from '@babel/types'

type OptionalPatternNode
  = | t.Identifier
    | t.AssignmentPattern
    | t.RestElement
    | t.ArrayPattern
    | t.ObjectPattern
    | t.VoidPattern

type OptionalFlagNode
  = | t.Identifier
    | t.AssignmentPattern
    | t.RestElement
    | t.ArrayPattern
    | t.ObjectPattern
    | t.ClassProperty
    | t.ClassPrivateProperty
    | t.ClassMethod
    | t.ClassPrivateMethod
    | t.ClassAccessorProperty

function isOptionalPatternNode(node: t.Node | null | undefined): node is OptionalPatternNode {
  return (
    t.isIdentifier(node)
    || t.isAssignmentPattern(node)
    || t.isRestElement(node)
    || t.isArrayPattern(node)
    || t.isObjectPattern(node)
    || t.isVoidPattern(node)
  )
}

function stripOptionalFlag(node: OptionalFlagNode | null | undefined) {
  if (node?.optional !== true) {
    return false
  }
  node.optional = false
  return true
}

function stripOptionalFromPattern(
  pattern: t.FunctionParameter | t.TSParameterProperty | null | undefined,
): boolean {
  if (!pattern) {
    return false
  }
  if (t.isTSParameterProperty(pattern)) {
    return stripOptionalFromPattern(pattern.parameter)
  }
  let changed = false
  if (
    t.isIdentifier(pattern)
    || t.isAssignmentPattern(pattern)
    || t.isRestElement(pattern)
    || t.isArrayPattern(pattern)
    || t.isObjectPattern(pattern)
  ) {
    changed = stripOptionalFlag(pattern) || changed
  }

  if (t.isIdentifier(pattern) || t.isVoidPattern(pattern)) {
    return changed
  }
  if (t.isAssignmentPattern(pattern)) {
    if (isOptionalPatternNode(pattern.left)) {
      changed = stripOptionalFromPattern(pattern.left) || changed
    }
    return changed
  }
  if (t.isRestElement(pattern)) {
    if (isOptionalPatternNode(pattern.argument)) {
      changed = stripOptionalFromPattern(pattern.argument) || changed
    }
    return changed
  }
  if (t.isObjectPattern(pattern)) {
    for (const prop of pattern.properties) {
      if (t.isRestElement(prop)) {
        if (isOptionalPatternNode(prop.argument) && stripOptionalFromPattern(prop.argument)) {
          changed = true
        }
      }
      else if (t.isObjectProperty(prop)) {
        if (isOptionalPatternNode(prop.value) && stripOptionalFromPattern(prop.value)) {
          changed = true
        }
      }
    }
    return changed
  }
  if (t.isArrayPattern(pattern)) {
    for (const element of pattern.elements) {
      if (isOptionalPatternNode(element) && stripOptionalFromPattern(element)) {
        changed = true
      }
    }
  }

  return changed
}

export function createMacroVisitors(state: TransformState) {
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
