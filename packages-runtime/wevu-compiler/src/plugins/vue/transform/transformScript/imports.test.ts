import { describe, expect, it } from 'vitest'
import { generate, parseJsLike, traverse } from '../../../../utils/babel'
import { createImportVisitors } from './imports'

describe('createImportVisitors', () => {
  it('moves selected vue imports to wevu and strips type-only imports', () => {
    const ast = parseJsLike(`
import { defineComponent, useSlots, useAttrs, type Ref } from 'vue'
import type { Foo } from './types'
import { createWevuComponent } from 'wevu'
const value = 1
    `.trim())

    const state: any = {
      transformed: false,
      defineComponentAliases: new Set<string>(),
      defineComponentDecls: new Map(),
      defaultExportPath: null,
    }

    traverse(ast, createImportVisitors(ast.program, state) as any)
    const code = generate(ast).code

    expect(state.transformed).toBe(true)
    expect(state.defineComponentAliases.has('defineComponent')).toBe(true)
    expect(code).toContain('virtual:weapp-vite/runtime')
    expect(code).toContain('useSlots')
    expect(code).toContain('useAttrs')
    expect(code).not.toContain('defineComponent')
    expect(code).not.toContain(`from './types'`)
  })

  it('moves known wevu value imports to scoped internal entries and keeps unknown imports', () => {
    const ast = parseJsLike(`
import { ref, onLoad, fetch, type Ref } from 'wevu'
const value = ref(1)
    `.trim())

    const state: any = {
      transformed: false,
      defineComponentAliases: new Set<string>(),
      defineComponentDecls: new Map(),
      defaultExportPath: null,
    }

    traverse(ast, createImportVisitors(ast.program, state) as any)
    const code = generate(ast).code

    expect(state.transformed).toBe(true)
    expect(code).toContain('virtual:weapp-vite/runtime/reactivity')
    expect(code).toContain('virtual:weapp-vite/runtime')
    expect(code).toContain('ref')
    expect(code).toContain('onLoad')
    expect(code).toContain(`import { fetch } from 'wevu'`)
    expect(code).not.toContain('type Ref')
  })
})
