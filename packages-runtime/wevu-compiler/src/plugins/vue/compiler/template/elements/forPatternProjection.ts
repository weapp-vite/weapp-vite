import type { Expression } from '@weapp-vite/ast/babelTypes'
import type { ForParseResult, TransformContext } from '../types'
import * as t from '@weapp-vite/ast/babelTypes'
import { parseJsLike, traverse } from '../../../../../utils/babel'
import { normalizeJsExpressionWithContext } from '../expression'
import { generateExpression } from '../expression/parse'

const RUNTIME_BINDING_REF_RE = /^__wv_bind_\d+(?:\[[A-Z_$][\w$]*\])*$/i

interface ProjectionIdentifiers {
  arrayIndex: t.Identifier
  arrayItem: t.Identifier
  key: t.Identifier
  keys: t.Identifier
  loopIndex: t.Identifier
  objectItem: t.Identifier
  result: t.Identifier
  source: t.Identifier
}

function createProjectionIdentifiers(
  sourceExpression: Expression,
  projector: t.ArrowFunctionExpression,
  reservedNames: ReadonlySet<string>,
): ProjectionIdentifiers {
  const reservedBindings = [...reservedNames]
    .filter(name => t.isValidIdentifier(name))
    .map(name => t.variableDeclarator(t.identifier(name)))
  const ast = t.file(t.program([
    ...(reservedBindings.length ? [t.variableDeclaration('let', reservedBindings)] : []),
    t.expressionStatement(t.sequenceExpression([
      t.cloneNode(sourceExpression, true),
      t.cloneNode(projector, true),
    ])),
  ]))
  let identifiers: ProjectionIdentifiers | undefined
  traverse(ast, {
    Program(path) {
      identifiers = {
        source: path.scope.generateUidIdentifierBasedOnNode(sourceExpression, 'source'),
        arrayItem: path.scope.generateUidIdentifier('item'),
        arrayIndex: path.scope.generateUidIdentifier('index'),
        result: path.scope.generateUidIdentifier('result'),
        keys: path.scope.generateUidIdentifier('keys'),
        loopIndex: path.scope.generateUidIdentifier('loopIndex'),
        key: path.scope.generateUidIdentifier('key'),
        objectItem: path.scope.generateUidIdentifier('item'),
      }
      path.stop()
    },
  })
  if (!identifiers) {
    throw new Error('无法为 v-for 解构投影分配局部标识符。')
  }
  return identifiers
}

function parseItemPattern(source: string): t.FunctionParameter | null {
  try {
    const ast = parseJsLike(`(${source}) => {}`)
    const statement = ast.program.body[0]
    if (!statement || !t.isExpressionStatement(statement)) {
      return null
    }
    const expression = statement.expression
    if (!t.isArrowFunctionExpression(expression) || expression.params.length !== 1) {
      return null
    }
    const pattern = expression.params[0]
    return t.isRestElement(pattern) ? null : pattern as t.FunctionParameter
  }
  catch {
    return null
  }
}

function createPatternProjector(
  pattern: t.FunctionParameter,
  aliasNames: string[],
  forInfo: ForParseResult,
) {
  const params: t.FunctionParameter[] = [t.cloneNode(pattern, true)]
  if (forInfo.index && t.isValidIdentifier(forInfo.index)) {
    params.push(t.identifier(forInfo.index))
  }
  const projected = t.objectExpression(aliasNames.map((name) => {
    return t.objectProperty(t.stringLiteral(name), t.identifier(name), true)
  }))
  return t.arrowFunctionExpression(params, projected)
}

function callPatternProjector(
  projector: t.ArrowFunctionExpression,
  item: t.Expression,
  index: t.Expression,
  forInfo: ForParseResult,
) {
  const args: t.Expression[] = [t.cloneNode(item, true)]
  if (forInfo.index && t.isValidIdentifier(forInfo.index)) {
    args.push(t.cloneNode(index, true))
  }
  return t.callExpression(t.cloneNode(projector, true), args)
}

function createArrayProjection(
  source: t.Identifier,
  projector: t.ArrowFunctionExpression,
  forInfo: ForParseResult,
  identifiers: ProjectionIdentifiers,
) {
  const { arrayIndex: index, arrayItem: item } = identifiers
  return t.callExpression(
    t.memberExpression(t.cloneNode(source), t.identifier('map')),
    [t.arrowFunctionExpression(
      [item, index],
      callPatternProjector(projector, item, index, forInfo),
    )],
  )
}

function createObjectProjection(
  source: t.Identifier,
  projector: t.ArrowFunctionExpression,
  forInfo: ForParseResult,
  identifiers: ProjectionIdentifiers,
) {
  const {
    key,
    keys,
    loopIndex,
    objectItem: item,
    result,
  } = identifiers
  return t.callExpression(
    t.arrowFunctionExpression([], t.blockStatement([
      t.variableDeclaration('const', [t.variableDeclarator(result, t.objectExpression([]))]),
      t.variableDeclaration('const', [t.variableDeclarator(
        keys,
        t.callExpression(t.memberExpression(t.identifier('Object'), t.identifier('keys')), [t.cloneNode(source)]),
      )]),
      t.forStatement(
        t.variableDeclaration('let', [t.variableDeclarator(loopIndex, t.numericLiteral(0))]),
        t.binaryExpression('<', loopIndex, t.memberExpression(keys, t.identifier('length'))),
        t.updateExpression('++', loopIndex),
        t.blockStatement([
          t.variableDeclaration('const', [t.variableDeclarator(key, t.memberExpression(keys, loopIndex, true))]),
          t.variableDeclaration('const', [t.variableDeclarator(item, t.memberExpression(source, key, true))]),
          t.expressionStatement(t.callExpression(
            t.memberExpression(t.identifier('Object'), t.identifier('defineProperty')),
            [
              result,
              key,
              t.objectExpression([
                t.objectProperty(t.identifier('configurable'), t.booleanLiteral(true)),
                t.objectProperty(t.identifier('enumerable'), t.booleanLiteral(true)),
                t.objectProperty(t.identifier('value'), callPatternProjector(projector, item, key, forInfo)),
                t.objectProperty(t.identifier('writable'), t.booleanLiteral(true)),
              ]),
            ],
          )),
        ]),
      ),
      t.returnStatement(result),
    ])),
    [],
  )
}

function createForPatternProjectionExpression(
  sourceExpression: Expression,
  projector: t.ArrowFunctionExpression,
  forInfo: ForParseResult,
  identifiers: ProjectionIdentifiers,
): Expression {
  const { source } = identifiers
  const numberCheck = t.logicalExpression(
    '&&',
    t.binaryExpression('===', t.unaryExpression('typeof', source), t.stringLiteral('number')),
    t.callExpression(t.memberExpression(t.identifier('Number'), t.identifier('isFinite')), [t.cloneNode(source)]),
  )
  const stringCheck = t.binaryExpression('===', t.unaryExpression('typeof', source), t.stringLiteral('string'))
  const objectCheck = t.logicalExpression(
    '&&',
    t.binaryExpression('!=', source, t.nullLiteral()),
    t.binaryExpression('===', t.unaryExpression('typeof', source), t.stringLiteral('object')),
  )
  const normalizeNumber = t.callExpression(
    t.memberExpression(t.identifier('Array'), t.identifier('from')),
    [
      t.objectExpression([t.objectProperty(
        t.identifier('length'),
        t.callExpression(t.memberExpression(t.identifier('Math'), t.identifier('max')), [
          t.numericLiteral(0),
          t.callExpression(t.memberExpression(t.identifier('Math'), t.identifier('floor')), [t.cloneNode(source)]),
        ]),
      )]),
      t.arrowFunctionExpression(
        [t.cloneNode(identifiers.arrayItem), t.cloneNode(identifiers.arrayIndex)],
        t.cloneNode(identifiers.arrayIndex),
      ),
    ],
  )
  const normalizeString = t.callExpression(t.memberExpression(t.identifier('Array'), t.identifier('from')), [t.cloneNode(source)])

  return t.callExpression(t.arrowFunctionExpression([], t.blockStatement([
    t.variableDeclaration('let', [t.variableDeclarator(source, t.cloneNode(sourceExpression, true))]),
    t.ifStatement(numberCheck, t.blockStatement([
      t.expressionStatement(t.assignmentExpression('=', source, normalizeNumber)),
    ])),
    t.ifStatement(stringCheck, t.blockStatement([
      t.expressionStatement(t.assignmentExpression('=', source, normalizeString)),
    ])),
    t.ifStatement(
      t.callExpression(t.memberExpression(t.identifier('Array'), t.identifier('isArray')), [t.cloneNode(source)]),
      t.blockStatement([t.returnStatement(createArrayProjection(source, projector, forInfo, identifiers))]),
    ),
    t.ifStatement(objectCheck, t.blockStatement([
      t.returnStatement(createObjectProjection(source, projector, forInfo, identifiers)),
    ])),
    t.returnStatement(t.cloneNode(source)),
  ])), [])
}

/**
 * 注册循环项模式投影，并返回模板与后续循环计算共用的绑定。
 */
export function registerForPatternProjection(
  forInfo: ForParseResult,
  listExp: string,
  listExpAst: NonNullable<ForParseResult['listExpAst']>,
  context: TransformContext,
) {
  const pattern = forInfo.itemPattern
  const sourceAst = RUNTIME_BINDING_REF_RE.test(listExp)
    ? normalizeJsExpressionWithContext(listExp, context, {
        hint: 'v-for 解构数据源',
        runtimePropAccess: 'helper',
        unrefMemberAccess: true,
        preserveForItems: true,
      })
    : listExpAst
  if (!pattern || !sourceAst) {
    return null
  }
  const rawPattern = parseItemPattern(pattern)
  const rawProjector = rawPattern
    ? createPatternProjector(rawPattern, Object.keys(forInfo.itemAliases ?? {}), forInfo)
    : null
  const projector = rawProjector
    ? normalizeJsExpressionWithContext(generateExpression(rawProjector), context, {
        hint: 'v-for 解构绑定',
        runtimePropAccess: 'helper',
        unrefMemberAccess: true,
        preserveForItems: true,
      })
    : null
  if (!projector || !t.isArrowFunctionExpression(projector)) {
    return null
  }
  const reservedNames = new Set<string>()
  for (const scope of context.scopeStack) {
    for (const name of scope) {
      reservedNames.add(name)
    }
  }
  for (const scope of context.forStack) {
    for (const name of [
      scope.item,
      scope.index,
      scope.key,
      ...Object.keys(scope.itemAliases ?? {}),
    ]) {
      if (name) {
        reservedNames.add(name)
      }
    }
  }
  for (const name of [
    forInfo.item,
    forInfo.index,
    forInfo.key,
    ...Object.keys(forInfo.itemAliases ?? {}),
  ]) {
    if (name) {
      reservedNames.add(name)
    }
  }
  const seed = context.classStyleBindings.filter(binding => binding.type === 'bind').length
  const identifiers = createProjectionIdentifiers(sourceAst, projector, reservedNames)
  const projectionAst = createForPatternProjectionExpression(sourceAst, projector, forInfo, identifiers)
  const bindingName = `__wv_bind_${seed}`
  const outerForStack = context.forStack.map(info => ({ ...info }))
  context.classStyleBindings.push({
    name: bindingName,
    type: 'bind',
    exp: `v-for 解构 ${pattern}`,
    expAst: projectionAst,
    forStack: outerForStack,
    conditions: context.bindingConditions?.slice(),
  })
  const indexAccess = outerForStack.map(info => `[${info.index ?? 'index'}]`).join('')
  const projectedListExp = `${bindingName}${indexAccess}`
  const projectedListExpAst = normalizeJsExpressionWithContext(projectedListExp, context, {
    hint: 'v-for 解构列表',
    runtimePropAccess: 'helper',
    unrefMemberAccess: true,
    preserveForItems: true,
  })
  return projectedListExpAst
    ? { listExp: projectedListExp, listExpAst: projectedListExpAst }
    : null
}
