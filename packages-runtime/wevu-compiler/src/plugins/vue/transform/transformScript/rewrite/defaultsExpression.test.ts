import { runInNewContext } from 'node:vm'
import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { generate, parseJsLike } from '../../../../../utils/babel'
import { applyWevuDefaultsToComponentOptions } from './defaults'

function compileDefaults(source: string) {
  const statement = parseJsLike(source).program.body[0]
  if (!t.isExpressionStatement(statement)) {
    throw new Error('缺少组件选项表达式')
  }
  applyWevuDefaultsToComponentOptions({
    componentExpr: statement.expression,
    parsedWevuDefaults: {
      component: { options: { styleIsolation: 'apply-shared', addGlobalClass: true, virtualHost: true } },
    },
    options: { isPage: true },
  })
  return generate(statement.expression).code
}

describe('component defaults expression ownership', () => {
  it.each([
    [`({ ['options']: { styleIsolation: 'isolated' } })`, { styleIsolation: 'isolated', addGlobalClass: true, virtualHost: false }],
    [`Object.assign({ [\`options\`]: { styleIsolation: 'isolated' } }, { setup() {} })`, { styleIsolation: 'isolated', addGlobalClass: true, virtualHost: false }],
    [`Object.assign({ options: { styleIsolation: 'isolated', addGlobalClass: false } }, { setup() {} })`, { styleIsolation: 'isolated', addGlobalClass: false, virtualHost: false }],
    [`Object.assign({ options: { styleIsolation: 'isolated' } }, { setup() {} })`, { styleIsolation: 'isolated', addGlobalClass: true, virtualHost: false }],
    [`Object.assign({ options: { styleIsolation: 'isolated' } }, { options: { addGlobalClass: false } })`, { styleIsolation: 'apply-shared', addGlobalClass: false, virtualHost: false }],
    [`({ options: { styleIsolation: 'isolated' }, options: { addGlobalClass: false } })`, { styleIsolation: 'apply-shared', addGlobalClass: false, virtualHost: false }],
    [`({ ...{ options: { styleIsolation: 'isolated' } } })`, { styleIsolation: 'isolated', addGlobalClass: true, virtualHost: false }],
    [`Object.assign({}, { options: { virtualHost: true } }, { setup() {} })`, { styleIsolation: 'apply-shared', addGlobalClass: true, virtualHost: true }],
  ])('preserves explicit options and adds only absent defaults: %s', (source, expected) => {
    const result = runInNewContext(`(${compileDefaults(source)})`)
    expect(result.options).toEqual(expected)
  })

  it('does not overwrite dynamic assign operands or invoke them more than once', () => {
    let calls = 0
    const external = { options: { styleIsolation: 'isolated', addGlobalClass: false } }
    const result = runInNewContext(`(${compileDefaults('Object.assign({}, readOptions(), { setup() {} })')})`, {
      readOptions: () => {
        calls += 1
        return external
      },
    })
    expect(calls).toBe(1)
    expect(result.options).toBe(external.options)
    expect(external.options).toEqual({ styleIsolation: 'isolated', addGlobalClass: false })
  })

  it('does not mutate a shared options object when applying nested defaults', () => {
    const shared = { styleIsolation: 'isolated' }
    const result = runInNewContext(`(${compileDefaults('Object.assign({ options: shared }, { setup() {} })')})`, { shared })
    expect(result.options).toEqual({ styleIsolation: 'isolated', addGlobalClass: true, virtualHost: false })
    expect(shared).toEqual({ styleIsolation: 'isolated' })
  })
})
