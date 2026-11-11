import type { Scope } from '@weapp-vite/ast/babelTraverse'
import type { InlineExpressionAsset } from '../../../compiler/template/types'
import { WEVU_INLINE_MAP_KEY } from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { traverse } from '../../../../../utils/babel'
import { buildInlineExpressionMap } from '../../../compiler/template/inlineExpressionMap'
import { ensureRuntimeImport } from '../../scriptRuntimeImport'
import { createStaticObjectKey, getObjectPropertyByKey } from '../utils'

function createUnrefImport(program: t.Program) {
  const names = new Set<string>()
  let scope: Scope | undefined
  traverse(t.file(program), {
    Program(path) { scope = path.scope },
    Identifier(path) { names.add(path.node.name) },
  })
  let identifier: t.Identifier
  do {
    identifier = scope!.generateUidIdentifier('wevuInlineUnref')
  } while (names.has(identifier.name))
  ensureRuntimeImport(program, 'unref', identifier.name)
  return identifier
}

function buildMethodsMergeFromSpreadSources(
  componentExpr: t.ObjectExpression,
  inlineMapExpr: t.ObjectExpression,
): t.Expression | null {
  const spreadSources: t.Expression[] = []
  for (const prop of componentExpr.properties) {
    if (!t.isSpreadElement(prop) || !t.isExpression(prop.argument)) {
      continue
    }
    const methodsAccess = t.optionalMemberExpression(
      t.cloneNode(prop.argument),
      t.identifier('methods'),
      false,
      true,
    )
    spreadSources.push(
      t.logicalExpression('||', methodsAccess, t.objectExpression([])),
    )
  }

  if (!spreadSources.length) {
    return null
  }

  return t.callExpression(
    t.memberExpression(t.identifier('Object'), t.identifier('assign')),
    [
      t.objectExpression([]),
      ...spreadSources,
      t.objectExpression([
        t.objectProperty(createStaticObjectKey(WEVU_INLINE_MAP_KEY), inlineMapExpr),
      ]),
    ],
  )
}

export function injectInlineExpressions(
  componentExpr: t.ObjectExpression,
  inlineExpressions: InlineExpressionAsset[],
  program?: t.Program,
): boolean {
  if (!inlineExpressions.length) {
    return false
  }
  const needsUnref = inlineExpressions.some(entry => entry.runtimeHelpers?.unref)
  if (needsUnref && !program) {
    throw new Error('注入 maybe-ref 内联表达式需要宿主脚本 AST。')
  }
  const inlineMapExpr = buildInlineExpressionMap(inlineExpressions, needsUnref ? createUnrefImport(program!) : undefined)
  const methodsProp = getObjectPropertyByKey(componentExpr, 'methods')
  if (!methodsProp) {
    const mergedMethods = buildMethodsMergeFromSpreadSources(componentExpr, inlineMapExpr)
    if (mergedMethods) {
      componentExpr.properties.push(
        t.objectProperty(
          createStaticObjectKey('methods'),
          mergedMethods,
        ),
      )
      return true
    }
    componentExpr.properties.push(
      t.objectProperty(
        createStaticObjectKey('methods'),
        t.objectExpression([
          t.objectProperty(createStaticObjectKey(WEVU_INLINE_MAP_KEY), inlineMapExpr),
        ]),
      ),
    )
    return true
  }
  if (!t.isObjectExpression(methodsProp.value)) {
    return false
  }
  const mapProp = getObjectPropertyByKey(methodsProp.value, WEVU_INLINE_MAP_KEY)
  if (!mapProp) {
    methodsProp.value.properties.push(
      t.objectProperty(createStaticObjectKey(WEVU_INLINE_MAP_KEY), inlineMapExpr),
    )
    return true
  }
  if (t.isObjectExpression(mapProp.value)) {
    mapProp.value.properties.push(...inlineMapExpr.properties)
    return true
  }
  return false
}
