import { describe, expect, it } from 'vitest'
import { generate, parseJsLike } from '../../../utils/babel'
import { pruneTemplateComponentMeta } from './scriptTemplateMeta'

describe('pruneTemplateComponentMeta', () => {
  it('returns false when template meta is empty', () => {
    const ast = parseJsLike(`import Foo from './Foo'`)
    expect(pruneTemplateComponentMeta(ast, {})).toBe(false)
  })

  it('removes unused template component import specifiers and returned getters', () => {
    const ast = parseJsLike(`
import Foo from './Foo'
import { Keep, Remove } from './bar'
const local = 1
export default {
  setup() {
    const __returned__ = { local, get Foo() { return Foo }, get Remove() { return Remove } }
    return __returned__
  },
}
    `.trim())

    const changed = pruneTemplateComponentMeta(ast, {
      Foo: '@/components/Foo',
      Remove: '@/components/Remove',
    })

    expect(changed).toBe(true)
    const output = generate(ast).code

    expect(output).not.toContain(`import Foo`)
    expect(output).toContain(`import { Keep } from './bar'`)
    expect(output).not.toContain(`get Foo()`)
    expect(output).not.toContain(`get Remove()`)
    expect(output).not.toContain(`__weappViteUsingComponent`)
    expect(output).not.toContain(`@/components/Foo`)
    expect(output).not.toContain(`@/components/Remove`)
  })

  it('keeps template component imports when script code references them', () => {
    const ast = parseJsLike(`
import Foo from './Foo'
console.log(Foo)
export default {
  setup() {
    const __returned__ = { get Foo() { return Foo } }
    return __returned__
  },
}
    `.trim())

    const changed = pruneTemplateComponentMeta(ast, {
      Foo: '@/components/Foo',
    })

    expect(changed).toBe(false)
    const output = generate(ast).code
    expect(output).toContain(`import Foo from './Foo'`)
    expect(output).toContain(`console.log(Foo)`)
    expect(output).toContain(`get Foo()`)
  })
})
