import { NodeTypes } from '@vue/compiler-core'
import { describe, expect, it } from 'vitest'
import { transformShowDirective } from './show'

function createContext() {
  return {
    warnings: [] as string[],
    rewriteScopedSlot: false,
    scopeStack: [],
    slotPropStack: [],
    forStack: [],
    mustacheInterpolation: 'compact',
  } as any
}

describe('transformShowDirective', () => {
  it('returns null when directive has no expression', () => {
    const context = createContext()
    const node = {
      exp: undefined,
    } as any

    expect(transformShowDirective(node, context)).toBeNull()
  })

  it('transforms v-show expression to style binding', () => {
    const context = createContext()
    const node = {
      exp: {
        type: NodeTypes.SIMPLE_EXPRESSION,
        content: 'visible',
      },
    } as any

    expect(transformShowDirective(node, context)).toBe(`style="{{visible ? '' : 'display: none'}}"`)
  })
})
