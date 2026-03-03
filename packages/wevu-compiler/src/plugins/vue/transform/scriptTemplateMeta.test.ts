import { describe, expect, it } from 'vitest'
import { generate, parseJsLike } from '../../../utils/babel'
import { injectTemplateComponentMeta } from './scriptTemplateMeta'

describe('injectTemplateComponentMeta', () => {
  it('returns false when template meta is empty', () => {
    const ast = parseJsLike(`import Foo from './Foo'`)
    expect(injectTemplateComponentMeta(ast, {})).toBe(false)
  })

  it('removes matched import specifiers and injects meta declarations', () => {
    const ast = parseJsLike(`
import Foo from './Foo'
import { Keep, Remove } from './bar'
const local = 1
    `.trim())

    const changed = injectTemplateComponentMeta(ast, {
      Foo: '@/components/Foo',
      Remove: '@/components/Remove',
    })

    expect(changed).toBe(true)
    const output = generate(ast).code

    expect(output).not.toContain(`import Foo`)
    expect(output).toContain(`import { Keep } from './bar'`)
    expect(output).toContain(`const Foo =`)
    expect(output).toContain(`const Remove =`)
    expect(output).toContain(`__weappViteUsingComponent: true`)
    expect(output).toContain(`from: "@/components/Foo"`)
    expect(output).toContain(`from: "@/components/Remove"`)
  })
})
