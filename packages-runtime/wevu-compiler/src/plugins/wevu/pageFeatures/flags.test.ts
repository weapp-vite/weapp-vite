import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it } from 'vitest'
import { collectWevuPageFeatureFlagsFromCode } from '../../../ast/operations/pageFeatures'
import { generate, parseJsLike } from '../../../utils/babel'
import { collectWevuPageFeatureFlags, injectWevuPageFeatureFlagsIntoOptionsObject } from './flags'
import { collectTargetOptionsObjects } from './optionsObjects'

describe('pageFeatures flags', () => {
  it('collects flags from named and namespace hook calls', () => {
    const ast = parseJsLike(`
import { onShareTimeline as onTimeline } from 'wevu'
import * as wevu from 'wevu'
onTimeline(() => ({}))
wevu.onPageScroll?.(() => ({}))
    `.trim())

    const enabled = collectWevuPageFeatureFlags(ast)
    expect(enabled.has('enableOnShareTimeline')).toBe(true)
    expect(enabled.has('enableOnPageScroll')).toBe(true)
  })

  it('collects flags from source code with oxc engine', () => {
    const enabled = collectWevuPageFeatureFlagsFromCode(`
import { onShareTimeline as onTimeline } from 'wevu'
import * as wevu from 'wevu'
onTimeline(() => ({}))
wevu.onPageScroll(() => ({}))
    `.trim(), {
      astEngine: 'oxc',
    })

    expect(enabled.has('enableOnShareTimeline')).toBe(true)
    expect(enabled.has('enableOnPageScroll')).toBe(true)
  })

  it('injects features object before setup and merges existing object', () => {
    const ast = parseJsLike(`
import { defineComponent } from 'wevu'
const ext = { fromExt: true }
defineComponent({
  features: {
    enableOnShareTimeline: false,
    ...ext,
  },
  setup() {},
})
    `.trim())

    const optionsObject = collectTargetOptionsObjects(ast, '/project/src/page.ts').optionsObjects[0]
    const changed = injectWevuPageFeatureFlagsIntoOptionsObject(
      optionsObject,
      new Set(['enableOnShareTimeline', 'enableOnShareAppMessage']),
    )

    expect(changed).toBe(true)
    const code = generate(optionsObject).code
    expect(code).toContain('enableOnShareTimeline: false')
    expect(code).toContain('enableOnShareAppMessage: true')
  })

  it('wraps non-object features expression with injected object and spread', () => {
    const optionsObject = t.objectExpression([
      t.objectProperty(t.identifier('features'), t.identifier('externalFeatures')),
      t.objectMethod('method', t.identifier('setup'), [], t.blockStatement([])),
    ])

    const changed = injectWevuPageFeatureFlagsIntoOptionsObject(
      optionsObject,
      new Set(['enableOnShareTimeline']),
    )

    expect(changed).toBe(true)
    const code = generate(optionsObject).code
    expect(code).toContain('enableOnShareTimeline: true')
    expect(code).toContain('...externalFeatures')
  })
})
