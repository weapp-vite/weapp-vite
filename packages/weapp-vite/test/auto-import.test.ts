import { resolvedComponentName } from '@/context/CompilerContext'

describe.skip('auto-import', () => {
  it('resolve component name', async () => {
    // await createCompilerContext()
    let res = resolvedComponentName('xx')
    expect(res).toBe('xx')
    res = resolvedComponentName('index')
    expect(res).toBe(undefined)
    res = resolvedComponentName('CCC/index')
    expect(res).toBe('CCC')
    res = resolvedComponentName('DDD/FFF')
    expect(res).toBe('FFF')
    res = resolvedComponentName('CCC/FFF/index')
    expect(res).toBe('FFF')
  })
})
