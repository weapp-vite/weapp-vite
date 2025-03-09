import { getCompilerContext } from './getInstance'

describe('getInstance', () => {
  it('getCompilerContext', () => {
    const ctx = getCompilerContext()
    expect(ctx).toBeDefined()
  })
})
