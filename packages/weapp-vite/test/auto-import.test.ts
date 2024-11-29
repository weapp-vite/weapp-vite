import { CompilerContext } from '@/context'

describe('auto-import', () => {
  it('resolve component name', async () => {
    const ctx = new CompilerContext()
    let res = ctx.resolvedComponentName('xx')
    expect(res).toBe('xx')
    res = ctx.resolvedComponentName('index')
    expect(res).toBe(undefined)
    res = ctx.resolvedComponentName('CCC/index')
    expect(res).toBe('CCC')
    res = ctx.resolvedComponentName('DDD/FFF')
    expect(res).toBe('FFF')
    res = ctx.resolvedComponentName('CCC/FFF/index')
    expect(res).toBe('FFF')
  })
})
