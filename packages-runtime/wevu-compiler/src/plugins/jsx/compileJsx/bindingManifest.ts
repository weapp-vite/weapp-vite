import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { WevuBindingKind, WevuBindingScopeV1 } from '../../../types/bindingManifest'
import type { JsxCompileContext } from './types'
import { recordSyntheticBindingExpression } from '../../vue/compiler/template/bindingManifest'
import { normalizeInterpolationExpression } from './ast'

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
    ...context.bindingScopeStack.map((locals, index) => ({
      kind: 'for' as const,
      depth: index + 1,
      locals: [...locals],
    })),
  ]
  recordSyntheticBindingExpression(
    context.bindingManifest,
    {
      kind,
      expression,
      outputPath,
      sourceLocation,
      scopes,
    },
    context.scopeStack,
  )
}
