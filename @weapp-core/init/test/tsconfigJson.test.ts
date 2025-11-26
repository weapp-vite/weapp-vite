import {
  getDefaultTsconfigAppJson,
  getDefaultTsconfigJson,
  getDefaultTsconfigNodeJson,
} from '@/tsconfigJson'

describe('tsconfigJson', () => {
  it('getDefaultTsconfigJson', () => {
    const config = getDefaultTsconfigJson()
    expect(config.references?.map(ref => ref.path)).toEqual([
      './tsconfig.app.json',
      './tsconfig.node.json',
    ])
    expect(config.files).toEqual([])
  })

  it('getDefaultTsconfigAppJson', () => {
    const config = getDefaultTsconfigAppJson()
    expect(config.compilerOptions?.target).toBe('ES2023')
    expect(config.compilerOptions?.types).toContain('miniprogram-api-typings')
    expect(config.include).toContain('src/**/*.ts')
    expect(config.compilerOptions?.noEmit).toBe(true)
  })

  it('getDefaultTsconfigNodeJson', () => {
    const config = getDefaultTsconfigNodeJson(['vite.config.ts', 'vite.config.ts'])
    expect(config.compilerOptions?.types).toContain('node')
    expect(config.include).toContain('vite.config.ts')
    expect(new Set(config.include ?? []).size).toBe((config.include ?? []).length)
  })
})
