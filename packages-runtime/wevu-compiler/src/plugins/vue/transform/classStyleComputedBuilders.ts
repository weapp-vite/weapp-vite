import type { ClassStyleBinding, ForParseResult } from '../compiler/template/types'
import type { ClassStyleHelperIds } from './classStyleComputed'
import {
  WEVU_EXPRESSION_ERROR_IDENTIFIER,
  WEVU_PROPS_KEY,
} from '@weapp-core/constants'
import * as t from '@weapp-vite/ast/babelTypes'

export function createStaticObjectKey(key: string) {
  return t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key)
}

function createValidIdentifier(name: string | undefined, fallback: string) {
  if (name && t.isValidIdentifier(name)) {
    return t.identifier(name)
  }
  return t.identifier(fallback)
}

function buildConsoleErrorGuard(message: string, errorId: t.Identifier) {
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
          [
            t.stringLiteral(message),
            t.cloneNode(errorId),
          ],
        ),
      ),
    ]),
  )
}

function buildRuntimeExpressionErrorGuard(binding: ClassStyleBinding, errorId: t.Identifier) {
  return buildConsoleErrorGuard(
    `[wevu] 模板运行时表达式执行失败: ${binding.name} = ${binding.exp}`,
    errorId,
  )
}

function createDataPropsFallbackExpression(fallback: t.Expression) {
  const propsObject = t.memberExpression(t.thisExpression(), t.identifier(WEVU_PROPS_KEY))
  const propsAccess = t.memberExpression(propsObject, t.identifier('data'))
  const hasPropsObject = t.binaryExpression('!=', propsObject, t.nullLiteral())
  const hasPropsValue = t.logicalExpression(
    '&&',
    hasPropsObject,
    t.logicalExpression(
      '||',
      t.binaryExpression('!==', propsAccess, t.identifier('undefined')),
      t.callExpression(
        t.memberExpression(
          t.memberExpression(
            t.memberExpression(t.identifier('Object'), t.identifier('prototype')),
            t.identifier('hasOwnProperty'),
          ),
          t.identifier('call'),
        ),
        [propsObject, t.stringLiteral('data')],
      ),
    ),
  )
  return t.conditionalExpression(hasPropsValue, propsAccess, fallback)
}

function createDataRuntimeAccess(helpers: ClassStyleHelperIds) {
  const unrefHelper = helpers.unref ? t.cloneNode(helpers.unref) : t.identifier('unref')
  return t.callExpression(unrefHelper, [
    createDataPropsFallbackExpression(
      t.memberExpression(t.thisExpression(), t.identifier('data')),
    ),
  ])
}

function rewriteDataAccessExpression(exp: t.Expression, helpers: ClassStyleHelperIds): t.Expression {
  if (t.isIdentifier(exp) && exp.name === 'data') {
    return createDataRuntimeAccess(helpers)
  }
  if (t.isMemberExpression(exp)) {
    return t.memberExpression(
      rewriteDataAccessExpression(exp.object as t.Expression, helpers),
      t.cloneNode(exp.property),
      exp.computed,
    )
  }
  if (t.isObjectExpression(exp)) {
    return t.objectExpression(exp.properties.map((property) => {
      if (!t.isObjectProperty(property) || !t.isExpression(property.value)) {
        return t.cloneNode(property, true)
      }
      return t.objectProperty(
        t.cloneNode(property.key),
        rewriteDataAccessExpression(property.value, helpers),
        property.computed,
        property.shorthand,
      )
    }))
  }
  if (t.isArrayExpression(exp)) {
    return t.arrayExpression(exp.elements.map((element) => {
      if (!element || t.isSpreadElement(element)) {
        return element ? t.cloneNode(element, true) : null
      }
      return rewriteDataAccessExpression(element as t.Expression, helpers)
    }))
  }
  if (t.isBinaryExpression(exp)) {
    return t.isPrivateName(exp.left) || t.isPrivateName(exp.right)
      ? t.cloneNode(exp, true)
      : t.binaryExpression(
          exp.operator,
          rewriteDataAccessExpression(exp.left as t.Expression, helpers),
          rewriteDataAccessExpression(exp.right as t.Expression, helpers),
        )
  }
  if (t.isLogicalExpression(exp)) {
    return t.logicalExpression(
      exp.operator,
      rewriteDataAccessExpression(exp.left as t.Expression, helpers),
      rewriteDataAccessExpression(exp.right as t.Expression, helpers),
    )
  }
  if (t.isConditionalExpression(exp)) {
    return t.conditionalExpression(
      rewriteDataAccessExpression(exp.test, helpers),
      rewriteDataAccessExpression(exp.consequent, helpers),
      rewriteDataAccessExpression(exp.alternate, helpers),
    )
  }
  if (t.isUnaryExpression(exp)) {
    return t.unaryExpression(exp.operator, rewriteDataAccessExpression(exp.argument, helpers), exp.prefix)
  }
  if (t.isCallExpression(exp)) {
    return t.callExpression(
      rewriteDataAccessExpression(exp.callee as t.Expression, helpers),
      exp.arguments.map((arg) => {
        if (t.isSpreadElement(arg)) {
          return t.cloneNode(arg, true)
        }
        return rewriteDataAccessExpression(arg as t.Expression, helpers)
      }),
    )
  }
  return t.cloneNode(exp, true)
}

function buildNormalizedExpression(
  binding: ClassStyleBinding,
  helpers: ClassStyleHelperIds,
) {
  const errorId = t.identifier(WEVU_EXPRESSION_ERROR_IDENTIFIER)
  if (binding.type === 'bind') {
    const exp = binding.expAst ? t.cloneNode(binding.expAst, true) : t.identifier('undefined')
    return t.callExpression(
      t.arrowFunctionExpression(
        [],
        t.blockStatement([
          t.tryStatement(
            t.blockStatement([t.returnStatement(exp)]),
            t.catchClause(
              t.cloneNode(errorId),
              t.blockStatement([
                buildRuntimeExpressionErrorGuard(binding, errorId),
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
  const normalizeHelper = binding.type === 'class'
    ? helpers.normalizeClass
    : helpers.normalizeStyle
  const errorFallback = binding.errorFallback ?? ''
  const exp = binding.expAst ? rewriteDataAccessExpression(binding.expAst, helpers) : t.stringLiteral('')

  const normalizedCall = t.callExpression(t.cloneNode(normalizeHelper), [exp])
  return t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement([
        t.tryStatement(
          t.blockStatement([t.returnStatement(normalizedCall)]),
          t.catchClause(
            t.cloneNode(errorId),
            t.blockStatement([
              buildRuntimeExpressionErrorGuard(binding, errorId),
              t.returnStatement(t.stringLiteral(errorFallback)),
            ]),
          ),
          null,
        ),
      ]),
    ),
    [],
  )
}

function buildArrayMapExpression(
  binding: ClassStyleBinding,
  forStack: ForParseResult[],
  level: number,
  listId: t.Identifier,
  helpers: ClassStyleHelperIds,
) {
  const itemParam = createValidIdentifier(forStack[level].item, `__wv_item_${level}`)
  const indexParam = createValidIdentifier(forStack[level].index, `__wv_index_${level}`)
  const body: t.Statement[] = []

  const keyName = forStack[level].key
  if (keyName && t.isValidIdentifier(keyName) && keyName !== indexParam.name) {
    body.push(t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(keyName), indexParam),
    ]))
  }

  // eslint-disable-next-line ts/no-use-before-define
  const inner = buildForExpression(binding, forStack, level + 1, helpers)
  body.push(t.returnStatement(inner))

  const callback = t.arrowFunctionExpression([itemParam, indexParam], t.blockStatement(body))
  return t.callExpression(
    t.memberExpression(listId, t.identifier('map')),
    [callback],
  )
}

function buildObjectMapExpression(
  binding: ClassStyleBinding,
  forStack: ForParseResult[],
  level: number,
  listId: t.Identifier,
  helpers: ClassStyleHelperIds,
) {
  const resId = t.identifier(`__wv_res_${level}`)
  const keysId = t.identifier(`__wv_keys_${level}`)
  const loopIndexId = t.identifier(`__wv_i_${level}`)
  const keyId = t.identifier(`__wv_key_${level}`)
  const itemId = t.identifier(`__wv_item_${level}`)

  const itemAlias = forStack[level].item
  const indexAlias = forStack[level].index
  const keyAlias = forStack[level].key
  const hasKeyAlias = Boolean(keyAlias && t.isValidIdentifier(keyAlias))

  const loopBody: t.Statement[] = [
    t.variableDeclaration('const', [
      t.variableDeclarator(keyId, t.memberExpression(keysId, loopIndexId, true)),
    ]),
    t.variableDeclaration('const', [
      t.variableDeclarator(itemId, t.memberExpression(listId, keyId, true)),
    ]),
  ]

  if (itemAlias && t.isValidIdentifier(itemAlias) && itemAlias !== itemId.name) {
    loopBody.push(t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(itemAlias), itemId),
    ]))
  }

  if (hasKeyAlias && keyAlias && keyAlias !== keyId.name) {
    loopBody.push(t.variableDeclaration('const', [
      t.variableDeclarator(t.identifier(keyAlias), keyId),
    ]))
  }

  if (indexAlias && t.isValidIdentifier(indexAlias)) {
    const source = hasKeyAlias ? loopIndexId : keyId
    if (indexAlias !== source.name) {
      loopBody.push(t.variableDeclaration('const', [
        t.variableDeclarator(t.identifier(indexAlias), source),
      ]))
    }
  }

  // eslint-disable-next-line ts/no-use-before-define
  const inner = buildForExpression(binding, forStack, level + 1, helpers)
  loopBody.push(t.expressionStatement(
    t.assignmentExpression(
      '=',
      t.memberExpression(resId, keyId, true),
      inner,
    ),
  ))

  const loop = t.forStatement(
    t.variableDeclaration('let', [
      t.variableDeclarator(loopIndexId, t.numericLiteral(0)),
    ]),
    t.binaryExpression(
      '<',
      loopIndexId,
      t.memberExpression(keysId, t.identifier('length')),
    ),
    t.updateExpression('++', loopIndexId),
    t.blockStatement(loopBody),
  )

  return t.blockStatement([
    t.variableDeclaration('const', [
      t.variableDeclarator(resId, t.objectExpression([])),
    ]),
    t.variableDeclaration('const', [
      t.variableDeclarator(
        keysId,
        t.callExpression(
          t.memberExpression(t.identifier('Object'), t.identifier('keys')),
          [listId],
        ),
      ),
    ]),
    loop,
    t.returnStatement(resId),
  ])
}

function buildForExpression(
  binding: ClassStyleBinding,
  forStack: ForParseResult[],
  level: number,
  helpers: ClassStyleHelperIds,
): t.Expression {
  if (level >= forStack.length) {
    return buildNormalizedExpression(binding, helpers)
  }

  const info = forStack[level]
  const listId = t.identifier(`__wv_list_${level}`)
  const listExp = info.listExpAst ? t.cloneNode(info.listExpAst, true) : t.arrayExpression([])
  const unrefHelper = helpers.unref ? t.cloneNode(helpers.unref) : t.identifier('unref')
  const listUnrefExp = t.callExpression(unrefHelper, [listExp])

  const listDecl = t.variableDeclaration('let', [
    t.variableDeclarator(listId, t.arrayExpression([])),
  ])

  const listSafeAssign = t.tryStatement(
    t.blockStatement([
      t.expressionStatement(t.assignmentExpression('=', listId, listUnrefExp)),
    ]),
    t.catchClause(
      t.identifier(`__wv_err_${level}`),
      t.blockStatement([
        buildConsoleErrorGuard(
          `[wevu] 模板 v-for 数据源表达式执行失败: ${info.listExp}`,
          t.identifier(`__wv_err_${level}`),
        ),
        t.expressionStatement(t.assignmentExpression('=', listId, t.arrayExpression([]))),
      ]),
    ),
    null,
  )

  const arrayCheck = t.callExpression(
    t.memberExpression(t.identifier('Array'), t.identifier('isArray')),
    [listId],
  )
  const arrayMap = buildArrayMapExpression(binding, forStack, level, listId, helpers)

  const objectCheck = t.logicalExpression(
    '&&',
    t.binaryExpression('!=', listId, t.nullLiteral()),
    t.binaryExpression(
      '===',
      t.unaryExpression('typeof', listId),
      t.stringLiteral('object'),
    ),
  )
  const objectBlock = buildObjectMapExpression(binding, forStack, level, listId, helpers)

  const fallbackReturn = t.returnStatement(t.arrayExpression([]))

  const body = t.blockStatement([
    listDecl,
    listSafeAssign,
    t.ifStatement(
      arrayCheck,
      t.blockStatement([t.returnStatement(arrayMap)]),
      t.ifStatement(
        objectCheck,
        objectBlock,
        t.blockStatement([fallbackReturn]),
      ),
    ),
  ])

  return t.callExpression(t.arrowFunctionExpression([], body), [])
}

export function buildComputedFunctionBody(
  binding: ClassStyleBinding,
  helpers: ClassStyleHelperIds,
): t.BlockStatement {
  const forStack = binding.forStack ?? []
  const expr = buildForExpression(binding, forStack, 0, helpers)
  return t.blockStatement([t.returnStatement(expr)])
}
