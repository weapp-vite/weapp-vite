import { describe, expect, it } from 'vitest'
import * as runtime from '../src/runtime'

describe('web runtime public entry', () => {
  it('installs host globals and exposes stable runtime commands', () => {
    expect((globalThis as any).wx.navigateTo).toBe(runtime.navigateTo)
    expect((globalThis as any).getApp).toBeTypeOf('function')
    expect((globalThis as any).getCurrentPages).toBeTypeOf('function')
    expect(runtime.installWebHostGlobals).toBeTypeOf('function')
    expect(runtime.initializePageRoutes).toBeTypeOf('function')
    expect(runtime.onAppShow).toBeTypeOf('function')
    expect(runtime.offAppShow).toBeTypeOf('function')
    expect(runtime.onAppHide).toBeTypeOf('function')
    expect(runtime.offAppHide).toBeTypeOf('function')
    expect(runtime.createRenderContext).toBeTypeOf('function')
    expect(runtime.bindRuntimeEvent).toBeTypeOf('function')
  })
})
