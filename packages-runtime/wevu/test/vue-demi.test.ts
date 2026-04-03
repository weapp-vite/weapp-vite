import { describe, expect, it } from 'vitest'
import { version as rootVersion } from '@/index'
import * as vueDemi from '@/vue-demi'

describe('vue-demi compatibility entry', () => {
  it('exposes Vue 3 branch flags and root reactivity/runtime apis', () => {
    expect(vueDemi.isVue2).toBe(false)
    expect(vueDemi.isVue3).toBe(true)
    expect(vueDemi.Vue2).toBeUndefined()
    expect(typeof vueDemi.install).toBe('function')
    expect(typeof vueDemi.ref).toBe('function')
    expect(typeof vueDemi.watchEffect).toBe('function')
    expect(typeof vueDemi.inject).toBe('function')
    expect(typeof vueDemi.createApp).toBe('function')
    expect(vueDemi.version).toBe(rootVersion)
  })
})
