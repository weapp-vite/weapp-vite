import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { createModuleAnalysis } from '../moduleAnalysis'
import { collectWevuHookCallsInFunctionBody } from './hooks'

describe('reachability hooks', () => {
  it('collects wevu hooks from named and namespace calls', () => {
    const module = createModuleAnalysis('/project/src/page.ts', t.file(t.program([
      t.importDeclaration(
        [
          t.importSpecifier(t.identifier('onTimeline'), t.identifier('onShareTimeline')),
          t.importNamespaceSpecifier(t.identifier('wevu')),
        ],
        t.stringLiteral('wevu'),
      ),
    ])))

    const fn = t.functionDeclaration(
      t.identifier('setup'),
      [],
      t.blockStatement([
        t.expressionStatement(t.callExpression(t.identifier('onTimeline'), [])),
        t.expressionStatement(t.callExpression(
          t.memberExpression(t.identifier('wevu'), t.identifier('onPageScroll')),
          [],
        )),
        t.expressionStatement(t.optionalCallExpression(
          t.memberExpression(t.identifier('wevu'), t.identifier('onReachBottom')),
          [],
          false,
        )),
      ]),
    )!

    const enabled = collectWevuHookCallsInFunctionBody(module, fn)
    expect(enabled.has('enableOnShareTimeline')).toBe(true)
    expect(enabled.has('enableOnPageScroll')).toBe(true)
    expect(enabled.has('enableOnReachBottom')).toBe(true)
  })
})
