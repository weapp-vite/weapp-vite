import type { ClassStyleBinding, ForParseResult } from '../compiler/template/types'
import * as t from '@babel/types'
import { generate } from '../../../utils/babel'

export interface ClassStyleHelperIds {
  normalizeClass: t.Identifier
  normalizeStyle: t.Identifier
  unref?: t.Identifier
}

export interface ClassStyleHelperNames {
  normalizeClassName: string
  normalizeStyleName: string
  unrefName?: string
}

function createStaticObjectKey(key: string) {
  return t.isValidIdentifier(key) ? t.identifier(key) : t.stringLiteral(key)
}

function createValidIdentifier(name: string | undefined, fallback: string) {
  if (name && t.isValidIdentifier(name)) {
    return t.identifier(name)
  }
  return t.identifier(fallback)
}

function buildNormalizedExpression(
  binding: ClassStyleBinding,
  helpers: ClassStyleHelperIds,
) {
  if (binding.type === 'bind') {
    const exp = binding.expAst ? t.cloneNode(binding.expAst, true) : t.identifier('undefined')
    return t.callExpression(
      t.arrowFunctionExpression(
        [],
        t.blockStatement([
          t.tryStatement(
            t.blockStatement([t.returnStatement(exp)]),
            t.catchClause(
              t.identifier('__wv_expr_err'),
              t.blockStatement([t.returnStatement(t.identifier('undefined'))]),
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
  const exp = binding.expAst ? t.cloneNode(binding.expAst, true) : t.stringLiteral('')

  const normalizedCall = t.callExpression(t.cloneNode(normalizeHelper), [exp])
  return t.callExpression(
    t.arrowFunctionExpression(
      [],
      t.blockStatement([
        t.tryStatement(
          t.blockStatement([t.returnStatement(normalizedCall)]),
          t.catchClause(
            t.identifier('__wv_expr_err'),
            t.blockStatement([t.returnStatement(t.stringLiteral(''))]),
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

function buildComputedFunctionBody(
  binding: ClassStyleBinding,
  helpers: ClassStyleHelperIds,
): t.BlockStatement {
  const forStack = binding.forStack ?? []
  const expr = buildForExpression(binding, forStack, 0, helpers)
  return t.blockStatement([t.returnStatement(expr)])
}

export function buildClassStyleComputedEntries(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperIds,
) {
  const entries: t.ObjectProperty[] = []
  for (const binding of bindings) {
    const key = createStaticObjectKey(binding.name)
    const body = buildComputedFunctionBody(binding, helpers)
    const fn = t.functionExpression(null, [], body)
    entries.push(t.objectProperty(key, fn))
  }
  return entries
}

export function buildClassStyleComputedObject(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperIds,
): t.ObjectExpression | null {
  if (!bindings.length) {
    return null
  }
  const entries = buildClassStyleComputedEntries(bindings, helpers)
  if (!entries.length) {
    return null
  }
  return t.objectExpression(entries)
}

export function buildClassStyleComputedCode(
  bindings: ClassStyleBinding[],
  helpers: ClassStyleHelperNames,
): string | null {
  if (!bindings.length) {
    return null
  }
  const obj = buildClassStyleComputedObject(bindings, {
    normalizeClass: t.identifier(helpers.normalizeClassName),
    normalizeStyle: t.identifier(helpers.normalizeStyleName),
    unref: t.identifier(helpers.unrefName ?? 'unref'),
  })
  if (!obj) {
    return null
  }
  const { code } = generate(obj, { compact: true })
  return code
}
