import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { ForParseResult } from '../../types'
import * as t from '@weapp-vite/ast/babelTypes'

function createConsoleErrorGuard(message: string, errorId: t.Identifier) {
  return t.ifStatement(
    t.logicalExpression(
      '&&',
      t.binaryExpression(
        '!==',
        t.unaryExpression('typeof', t.identifier('console')),
        t.stringLiteral('undefined'),
      ),
      t.binaryExpression(
        '===',
        t.unaryExpression('typeof', t.memberExpression(t.identifier('console'), t.identifier('error'))),
        t.stringLiteral('function'),
      ),
    ),
    t.blockStatement([
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(t.identifier('console'), t.identifier('error')),
          [t.stringLiteral(message), t.cloneNode(errorId)],
        ),
      ),
    ]),
  )
}

function createConsoleWarnGuard(message: string, item: t.Expression) {
  return t.ifStatement(
    t.logicalExpression(
      '&&',
      t.binaryExpression(
        '!==',
        t.unaryExpression('typeof', t.identifier('console')),
        t.stringLiteral('undefined'),
      ),
      t.binaryExpression(
        '===',
        t.unaryExpression('typeof', t.memberExpression(t.identifier('console'), t.identifier('warn'))),
        t.stringLiteral('function'),
      ),
    ),
    t.blockStatement([
      t.expressionStatement(
        t.callExpression(
          t.memberExpression(t.identifier('console'), t.identifier('warn')),
          [t.stringLiteral(message), t.cloneNode(item)],
        ),
      ),
    ]),
  )
}

function createHasOwnPropertyCall(item: t.Expression, field: string) {
  return t.callExpression(
    t.memberExpression(
      t.memberExpression(
        t.memberExpression(t.identifier('Object'), t.identifier('prototype')),
        t.identifier('hasOwnProperty'),
      ),
      t.identifier('call'),
    ),
    [t.cloneNode(item), t.stringLiteral(field)],
  )
}

function createSafeKeyExpression(exp: Expression, rawExp: string, seed: number, item?: t.Expression) {
  const errorId = t.identifier(`__wv_for_key_error_${seed}`)
  const shouldReportError = item
    ? t.binaryExpression('!=', t.cloneNode(item), t.nullLiteral())
    : t.booleanLiteral(true)
  return t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement([
        t.tryStatement(
          t.blockStatement([t.returnStatement(t.cloneNode(exp, true))]),
          t.catchClause(
            errorId,
            t.blockStatement([
              t.ifStatement(
                shouldReportError,
                t.blockStatement([
                  createConsoleErrorGuard(`[wevu] v-for :key 表达式执行失败: ${rawExp}`, errorId),
                ]),
              ),
              t.returnStatement(t.identifier('undefined')),
            ]),
          ),
          null,
        ),
      ]),
    ),
    [],
  )
}

function createProjectedItemExpression(
  item: t.Expression,
  keyExp: Expression,
  rawKeyExp: string,
  keyField: string,
  valueField: string,
  seed: number,
) {
  const isObject = t.logicalExpression(
    '&&',
    t.binaryExpression('!=', t.cloneNode(item), t.nullLiteral()),
    t.binaryExpression('===', t.unaryExpression('typeof', t.cloneNode(item)), t.stringLiteral('object')),
  )
  const projected = t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement([
        t.ifStatement(
          t.logicalExpression(
            '||',
            createHasOwnPropertyCall(item, keyField),
            createHasOwnPropertyCall(item, valueField),
          ),
          t.blockStatement([
            createConsoleWarnGuard(
              `[wevu] v-for :key 内部字段冲突，投影将使用保留字段 ${keyField} / ${valueField}`,
              item,
            ),
          ]),
        ),
        t.returnStatement(
          t.callExpression(
            t.memberExpression(t.identifier('Object'), t.identifier('assign')),
            [
              t.objectExpression([]),
              t.cloneNode(item),
              t.objectExpression([
                t.objectProperty(
                  t.stringLiteral(valueField),
                  t.cloneNode(item),
                ),
                t.objectProperty(
                  t.stringLiteral(keyField),
                  createSafeKeyExpression(keyExp, rawKeyExp, seed, item),
                ),
              ]),
            ],
          ),
        ),
      ]),
    ),
    [],
  )
  const primitiveProjected = t.objectExpression([
    t.objectProperty(t.stringLiteral(valueField), t.cloneNode(item)),
    t.objectProperty(
      t.stringLiteral(keyField),
      createSafeKeyExpression(keyExp, rawKeyExp, seed, item),
    ),
  ])
  return t.conditionalExpression(isObject, projected, primitiveProjected)
}

function createArrayProjection(
  sourceId: t.Identifier,
  keyExp: Expression,
  rawKeyExp: string,
  keyField: string,
  valueField: string,
  forInfo: ForParseResult,
  seed: number,
) {
  const itemId = forInfo.item && t.isValidIdentifier(forInfo.item)
    ? t.identifier(forInfo.item)
    : t.identifier(`__wv_for_key_item_${seed}`)
  const indexId = forInfo.index && t.isValidIdentifier(forInfo.index)
    ? t.identifier(forInfo.index)
    : t.identifier(`__wv_for_key_index_${seed}`)
  const body: t.Statement[] = []
  if (forInfo.key && t.isValidIdentifier(forInfo.key) && forInfo.key !== indexId.name) {
    body.push(t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(forInfo.key), t.cloneNode(indexId)),
    ]))
  }
  body.push(t.returnStatement(
    createProjectedItemExpression(itemId, keyExp, rawKeyExp, keyField, valueField, seed),
  ))
  return t.callExpression(
    t.memberExpression(t.cloneNode(sourceId), t.identifier('map')),
    [t.arrowFunctionExpression([itemId, indexId], t.blockStatement(body))],
  )
}

function createObjectProjection(
  sourceId: t.Identifier,
  keyExp: Expression,
  rawKeyExp: string,
  keyField: string,
  valueField: string,
  forInfo: ForParseResult,
  seed: number,
) {
  const resultId = t.identifier(`__wv_for_key_result_${seed}`)
  const keysId = t.identifier(`__wv_for_key_keys_${seed}`)
  const loopIndexId = t.identifier(`__wv_for_key_loop_index_${seed}`)
  const sourceKeyId = t.identifier(`__wv_for_key_source_key_${seed}`)
  const sourceItemId = t.identifier(`__wv_for_key_source_item_${seed}`)
  const body: t.Statement[] = [
    t.variableDeclaration('const', [
      t.variableDeclarator(sourceKeyId, t.memberExpression(keysId, loopIndexId, true)),
    ]),
    t.variableDeclaration('const', [
      t.variableDeclarator(sourceItemId, t.memberExpression(sourceId, sourceKeyId, true)),
    ]),
  ]

  if (forInfo.item && t.isValidIdentifier(forInfo.item) && forInfo.item !== sourceItemId.name) {
    body.push(t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(forInfo.item), t.cloneNode(sourceItemId)),
    ]))
  }
  if (forInfo.key && t.isValidIdentifier(forInfo.key) && forInfo.key !== sourceKeyId.name) {
    body.push(t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(forInfo.key), t.cloneNode(sourceKeyId)),
    ]))
  }
  if (forInfo.index && t.isValidIdentifier(forInfo.index)) {
    const source = forInfo.key ? loopIndexId : sourceKeyId
    if (forInfo.index !== source.name) {
      body.push(t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(forInfo.index), t.cloneNode(source)),
      ]))
    }
  }

  body.push(t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(resultId, sourceKeyId, true),
      createProjectedItemExpression(sourceItemId, keyExp, rawKeyExp, keyField, valueField, seed),
    ),
  ))

  return t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement([
        t.variableDeclaration('const', [
          t.variableDeclarator(resultId, t.objectExpression([])),
        ]),
        t.variableDeclaration('const', [
          t.variableDeclarator(
            keysId,
            t.callExpression(
              t.memberExpression(t.identifier('Object'), t.identifier('keys')),
              [t.cloneNode(sourceId)],
            ),
          ),
        ]),
        t.forStatement(
          t.variableDeclaration('let', [
            t.variableDeclarator(loopIndexId, t.numericLiteral(0)),
          ]),
          t.binaryExpression('<', loopIndexId, t.memberExpression(keysId, t.identifier('length'))),
          t.updateExpression('++', loopIndexId),
          t.blockStatement(body),
        ),
        t.returnStatement(resultId),
      ]),
    ),
    [],
  )
}

export function createForKeyProjectionExpression(
  sourceExp: Expression,
  keyExp: Expression,
  rawKeyExp: string,
  keyField: string,
  valueField: string,
  forInfo: ForParseResult,
  seed: number,
) {
  const sourceId = t.identifier(`__wv_for_key_source_${seed}`)
  const objectCheck = t.logicalExpression(
    '&&',
    t.binaryExpression('!=', t.cloneNode(sourceId), t.nullLiteral()),
    t.binaryExpression('===', t.unaryExpression('typeof', t.cloneNode(sourceId)), t.stringLiteral('object')),
  )
  return t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement([
        t.variableDeclaration('const', [
          t.variableDeclarator(sourceId, t.cloneNode(sourceExp, true)),
        ]),
        t.ifStatement(
          t.callExpression(
            t.memberExpression(t.identifier('Array'), t.identifier('isArray')),
            [t.cloneNode(sourceId)],
          ),
          t.blockStatement([
            t.returnStatement(createArrayProjection(sourceId, keyExp, rawKeyExp, keyField, valueField, forInfo, seed)),
          ]),
        ),
        t.ifStatement(
          objectCheck,
          t.blockStatement([
            t.returnStatement(createObjectProjection(sourceId, keyExp, rawKeyExp, keyField, valueField, forInfo, seed)),
          ]),
        ),
        t.returnStatement(t.cloneNode(sourceId)),
      ]),
    ),
    [],
  )
}
