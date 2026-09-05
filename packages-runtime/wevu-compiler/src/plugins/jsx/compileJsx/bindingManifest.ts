import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { WevuBindingKind, WevuBindingScopeV1 } from '../../../types/bindingManifest'
import type { JsxCompileContext } from './types'
import path from 'node:path'
import { recordSyntheticBindingExpression } from '../../vue/compiler/template/bindingManifest'
import { normalizeInterpolationExpression } from './ast'

function normalizeSourceFile(filename: string) {
  return filename.replaceAll('\\', '/')
}

function resolveBindingSourceFile(context: JsxCompileContext, ownerFile: string | undefined) {
  if (!ownerFile || !context.filename || path.resolve(ownerFile) === path.resolve(context.filename)) {
    return undefined
  }
  if (!context.bindingManifest.sourceFile) {
    return normalizeSourceFile(ownerFile)
  }
  const relativeOwner = path.relative(path.dirname(context.filename), ownerFile)
  return normalizeSourceFile(path.join(
    path.dirname(context.bindingManifest.sourceFile),
    relativeOwner,
  ))
}

/**
 * 在 JSX 首次渲染遍历中记录绑定及其源码位置。
 */
export function recordJsxBinding(
  context: JsxCompileContext,
  node: Expression,
  kind: WevuBindingKind,
  outputPath?: string,
) {
  const expression = normalizeInterpolationExpression(node)
  const sourceFile = resolveBindingSourceFile(context, node.loc?.filename)
  const sourceLocation = node.loc && node.start != null && node.end != null
    ? {
        start: {
          offset: node.start,
          line: node.loc.start.line,
          column: node.loc.start.column + 1,
        },
        end: {
          offset: node.end,
          line: node.loc.end.line,
          column: node.loc.end.column + 1,
        },
      }
    : undefined
  const scopes: WevuBindingScopeV1[] = [
    { kind: 'root', depth: 0 },
    ...context.bindingScopeStack.map((scope, index) => ({
      kind: 'for' as const,
      depth: index + 1,
      locals: [...scope.locals],
    })),
  ]
  recordSyntheticBindingExpression(
    context.bindingManifest,
    {
      kind,
      expression,
      outputPath,
      sourceFile,
      sourceLocation,
      scopes,
      scopeDependencies: context.bindingScopeStack.map(scope => ({
        expression: scope.sourceExpression,
        locals: scope.sourceLocals,
      })),
    },
    context.scopeStack,
  )
}
