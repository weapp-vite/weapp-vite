import { getCompilerContext } from './getInstance'

describe('getInstance', () => {
  it('getCompilerContext', () => {
    const ctx0 = getCompilerContext()
    const ctx1 = getCompilerContext()
    expect(ctx0 === ctx1).toBe(true)
  })
})
