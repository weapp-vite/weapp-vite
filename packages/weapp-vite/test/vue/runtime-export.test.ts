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
      type: 'component',
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
    expect(options.type).toBe('component')
    expect(options.data).toBeDefined()
  })

  it('should support component options', () => {
    const options: WevuComponentOptions = {
      type: 'component',
      data() {
        return {
          message: 'Hello',
        }
      },
    }

    expect(options.type).toBe('component')
  })

  it('should support page options', () => {
    const options: WevuComponentOptions = {
      type: 'page',
      data() {
        return {
          pageTitle: 'My Page',
        }
      },
    }

    expect(options.type).toBe('page')
  })
})
