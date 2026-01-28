import { compileVueFile, WE_VU_MODULE_ID } from '@/index'

describe('tsdown template', () => {
  it('exports compiler entry', () => {
    expect(typeof compileVueFile).toBe('function')
  })

  it('exports wevu module id', () => {
    expect(WE_VU_MODULE_ID).toBe('wevu')
  })
})
