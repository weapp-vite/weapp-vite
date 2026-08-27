import * as t from '@weapp-vite/ast/babelTypes'

const ESM_SYNTAX_RE = /\bimport(?=[\s{'"*])|\bexport(?=[\s{*])/

export function hasEsmSyntax(source: string) {
  return ESM_SYNTAX_RE.test(source)
}

export function createExportAllStatements(
  source: t.StringLiteral,
  scope: { generateUidIdentifier: (name: string) => t.Identifier },
) {
  const requireId = scope.generateUidIdentifier('reExported')
  const exportKeyId = scope.generateUidIdentifier('exportKey')
  return [
    t.variableDeclaration('const', [
      t.variableDeclarator(
        requireId,
        t.callExpression(t.identifier('require'), [source]),
      ),
    ]),
    t.expressionStatement(
      t.callExpression(
        t.memberExpression(
          t.callExpression(
            t.memberExpression(t.identifier('Object'), t.identifier('keys')),
            [requireId],
          ),
          t.identifier('forEach'),
        ),
        [
          t.arrowFunctionExpression(
            [exportKeyId],
            t.blockStatement([
              t.ifStatement(
                t.logicalExpression(
                  '||',
                  t.binaryExpression('===', exportKeyId, t.stringLiteral('default')),
                  t.binaryExpression('===', exportKeyId, t.stringLiteral('__esModule')),
                ),
                t.returnStatement(),
              ),
              t.expressionStatement(
                t.assignmentExpression(
                  '=',
                  t.memberExpression(t.identifier('exports'), exportKeyId, true),
                  t.memberExpression(requireId, exportKeyId, true),
                ),
              ),
            ]),
          ),
        ],
      ),
    ),
  ]
}
