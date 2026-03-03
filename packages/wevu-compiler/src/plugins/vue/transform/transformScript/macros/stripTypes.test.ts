import { describe, expect, it } from 'vitest'
import { generate, parseJsLike, traverse } from '../../../../../utils/babel'
import { createStripTypesVisitors } from './stripTypes'

describe('createStripTypesVisitors', () => {
  it('strips TS syntax nodes and compiler-only helper calls', () => {
    const ast = parseJsLike(`
type Foo = { name: string }
interface Bar { id: number }
enum Kind { A = 'a' }

const value = (foo as any)!
const check = (value satisfies number)
const boxed = new Box<number>()

function run(a?: number): string {
  return String(a)
}

__expose()
__expose({ keep: true })

export type { Foo }
export { value }
    `.trim())

    const state: any = {
      transformed: false,
      defineComponentAliases: new Set<string>(),
      defineComponentDecls: new Map(),
      defaultExportPath: null,
    }

    traverse(ast, createStripTypesVisitors(state) as any)
    const code = generate(ast).code

    expect(state.transformed).toBe(true)
    expect(code).not.toContain('type Foo')
    expect(code).not.toContain('interface Bar')
    expect(code).not.toContain('enum Kind')
    expect(code).not.toContain('as any')
    expect(code).not.toContain('satisfies')
    expect(code).not.toContain('__expose();')
    expect(code).toContain('__expose({')
    expect(code).toContain('new Box()')
  })

  it('strips advanced TS nodes and keeps runtime fields', () => {
    const ast = parseJsLike(`
namespace NS {
  export const value = 1
}
import Foo = require('./foo')

const typed: number = 1
const called = fn<string>()
const nonNull = maybe!
const mix = {
  __name: 'demo',
  keep: true,
}

class User {
  name?: string
  constructor(public age?: number) {}
}

export { type Foo as FooType, typed }
    `.trim())

    const state: any = {
      transformed: false,
      defineComponentAliases: new Set<string>(),
      defineComponentDecls: new Map(),
      defaultExportPath: null,
    }

    traverse(ast, createStripTypesVisitors(state) as any)
    const code = generate(ast).code

    expect(state.transformed).toBe(true)
    expect(code).not.toContain('namespace NS')
    expect(code).not.toContain('import Foo =')
    expect(code).not.toContain('__name')
    expect(code).not.toContain('<string>')
    expect(code).not.toContain('type Foo as FooType')
    expect(code).toContain('export { typed }')
    expect(code).toContain('constructor(age)')
    expect(code).toContain('const called = fn()')
  })
})
