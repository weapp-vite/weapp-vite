import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { collectCalledBindingsFromFunctionBody, getCallCalleeName } from './calls'

describe('reachability calls', () => {
  it('resolves identifier/member call callee names', () => {
    expect(getCallCalleeName(t.identifier('run'))).toEqual({
      type: 'ident',
      name: 'run',
    })
    expect(getCallCalleeName(
      t.memberExpression(t.identifier('ns'), t.identifier('invoke')),
    )).toEqual({
      type: 'member',
      object: 'ns',
      property: 'invoke',
    })
    expect(getCallCalleeName(
      t.memberExpression(t.identifier('ns'), t.stringLiteral('invoke'), true),
    )).toBeNull()
  })

  it('collects call bindings from function body including optional calls', () => {
    const fn = t.functionDeclaration(
      t.identifier('setup'),
      [],
      t.blockStatement([
        t.expressionStatement(t.callExpression(t.identifier('localFn'), [])),
        t.expressionStatement(
          t.optionalCallExpression(
            t.memberExpression(t.identifier('helpers'), t.identifier('useShare')),
            [],
            false,
          ),
        ),
      ]),
    )!

    const called = collectCalledBindingsFromFunctionBody(fn)
    expect(called).toContainEqual({
      type: 'ident',
      name: 'localFn',
    })
    expect(called).toContainEqual({
      type: 'member',
      object: 'helpers',
      property: 'useShare',
    })
  })
})
