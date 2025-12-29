import type { ComputedDefinitions, MethodDefinitions, WevuComponentOptions } from 'weapp-vite'
import { describe, expect, it } from 'vitest'
import { createWevuComponent } from 'weapp-vite'

describe('Runtime API Exports', () => {
  it('should export createWevuComponent function', () => {
    expect(createWevuComponent).toBeDefined()
    expect(typeof createWevuComponent).toBe('function')
  })

  it('should export WevuComponentOptions type', () => {
    const options: WevuComponentOptions = {
      data() {
        return {
          count: 0,
        }
      },
      computed: {} as ComputedDefinitions,
      methods: {
        increment() {
          // @ts-expect-error - test purpose
          this.count++
        },
      } as MethodDefinitions,
    }

    expect(options).toBeDefined()
    expect(options.data).toBeDefined()
  })

  it('should support arbitrary mini-program fields', () => {
    const options: WevuComponentOptions = {
      data() {
        return {
          message: 'Hello',
        }
      },
      // mini-program specific fields pass-through
      options: { multipleSlots: true },
    }

    expect(options.options).toMatchObject({ multipleSlots: true })
  })
})
