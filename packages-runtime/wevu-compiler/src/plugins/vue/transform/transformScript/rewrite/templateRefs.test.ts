import * as t from '@weapp-vite/ast/babelTypes'
import { describe, expect, it, vi } from 'vitest'
import { generate } from '../../../../../utils/babel'
import { injectTemplateRefs } from './templateRefs'

describe('injectTemplateRefs', () => {
  it('returns false when no bindings are provided', () => {
    const optionsObject = t.objectExpression([])
    expect(injectTemplateRefs(optionsObject, [])).toBe(false)
  })

  it('injects bindings into empty options object', () => {
    const optionsObject = t.objectExpression([])
    const changed = injectTemplateRefs(optionsObject, [
      {
        selector: '.card',
        inFor: false,
        name: 'cardRef',
      },
    ])

    expect(changed).toBe(true)
    const code = generate(optionsObject).code
    expect(code).toContain('__wevuTemplateRefs')
    expect(code).toContain('selector: ".card"')
    expect(code).toContain('name: "cardRef"')
  })

  it('appends to existing array binding', () => {
    const optionsObject = t.objectExpression([
      t.objectProperty(
        t.identifier('__wevuTemplateRefs'),
        t.arrayExpression([]),
      ),
    ])

    expect(injectTemplateRefs(optionsObject, [
      {
        selector: '#id',
        inFor: true,
      },
    ])).toBe(true)

    const code = generate(optionsObject).code
    expect(code).toContain('selector: "#id"')
    expect(code).toContain('inFor: true')
  })

  it('wraps identifier target with injected array and spread', () => {
    const optionsObject = t.objectExpression([
      t.objectProperty(
        t.identifier('__wevuTemplateRefs'),
        t.identifier('existingRefs'),
      ),
    ])

    expect(injectTemplateRefs(optionsObject, [
      {
        selector: '.a',
        inFor: false,
      },
    ])).toBe(true)

    const code = generate(optionsObject).code
    expect(code).toContain('...existingRefs')
  })

  it('warns and returns false when existing target is not mergeable', () => {
    const warn = vi.fn()
    const optionsObject = t.objectExpression([
      t.objectProperty(
        t.identifier('__wevuTemplateRefs'),
        t.stringLiteral('bad'),
      ),
    ])

    expect(injectTemplateRefs(optionsObject, [
      {
        selector: '.a',
        inFor: false,
      },
    ], warn)).toBe(false)
    expect(warn).toHaveBeenCalled()
  })
})
