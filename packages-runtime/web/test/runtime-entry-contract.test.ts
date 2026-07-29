import { describe, expect, it } from 'vitest'
import * as runtime from '../src/runtime'

describe('web runtime public entry', () => {
  it('installs host globals and exposes stable runtime commands', () => {
    expect(runtime.installWebHostGlobals).toBeTypeOf('function')
    expect(runtime.initializePageRoutes).toBeTypeOf('function')
    expect(runtime.createRenderContext).toBeTypeOf('function')
  })
})
