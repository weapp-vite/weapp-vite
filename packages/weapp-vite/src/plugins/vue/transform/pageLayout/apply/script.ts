import type { File as BabelFile } from '@weapp-vite/ast/babelTypes'
import type { LayoutPropValue } from '../types'
import {
  WEVU_EXPRESSION_ERROR_IDENTIFIER,
  WEVU_LAYOUT_BIND_PREFIX,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'
import { BABEL_TS_MODULE_PARSER_OPTIONS, parse as babelParse, generate } from '../../../../../utils/babel'
import { createStaticObjectKey, findWevuOptionsObject, getObjectPropertyByKey, parseExpressionAst } from '../ast'

export function injectLayoutBindingComputed(script: string | undefined, props: Record<string, LayoutPropValue> | undefined) {
  if (!script || !props) {
    return script
  }

  const runtimeEntries = Object.entries(props)
    .filter((entry): entry is [string, { kind: 'expression', expression: string }] => typeof entry[1] === 'object' && entry[1] !== null && 'kind' in entry[1] && entry[1].kind === 'expression')

  if (runtimeEntries.length === 0) {
    return script
  }

  const ast = babelParse(script, BABEL_TS_MODULE_PARSER_OPTIONS) as BabelFile
  const optionsObject = findWevuOptionsObject(ast)
  if (!optionsObject) {
    return script
  }

  const computedEntries = runtimeEntries.map(([key, value]) => {
    const expressionAst = parseExpressionAst(value.expression) ?? t.identifier('undefined')
    return t.objectProperty(
      createStaticObjectKey(`${WEVU_LAYOUT_BIND_PREFIX}${key}`),
      t.functionExpression(
        null,
        [],
        t.blockStatement([
          t.tryStatement(
            t.blockStatement([
              t.returnStatement(expressionAst),
            ]),
            t.catchClause(
              t.identifier(WEVU_EXPRESSION_ERROR_IDENTIFIER),
              t.blockStatement([
                t.returnStatement(t.identifier('undefined')),
              ]),
            ),
            null,
          ),
        ]),
      ),
    )
  })

  const computedProp = getObjectPropertyByKey(optionsObject, 'computed')
  if (!computedProp) {
    optionsObject.properties.unshift(
      t.objectProperty(createStaticObjectKey('computed'), t.objectExpression(computedEntries)),
    )
  }
  else if (t.isObjectExpression(computedProp.value)) {
    const computedValue = computedProp.value as t.ObjectExpression
    computedValue.properties.push(...computedEntries)
  }
  else if (t.isIdentifier(computedProp.value) || t.isMemberExpression(computedProp.value)) {
    computedProp.value = t.objectExpression([
      ...computedEntries,
      t.spreadElement(t.cloneNode(computedProp.value, true)),
    ])
  }
  else {
    return script
  }

  return generate(ast, { retainLines: true }).code
}
