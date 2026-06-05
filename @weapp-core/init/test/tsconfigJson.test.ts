import {
  getDefaultTsconfigAppJson,
  getDefaultTsconfigJson,
  getDefaultTsconfigNodeJson,
  getDefaultTsconfigServerJson,
  getDefaultTsconfigSharedJson,
} from '@/tsconfigJson'

describe('tsconfigJson', () => {
  it('getDefaultTsconfigJson', () => {
    const config = getDefaultTsconfigJson()
    expect(config.references?.map(ref => ref.path)).toEqual([
      './.weapp-vite/tsconfig.app.json',
      './.weapp-vite/tsconfig.server.json',
      './.weapp-vite/tsconfig.node.json',
      './.weapp-vite/tsconfig.shared.json',
    ])
    expect(config.files).toEqual([])
  })

  it('getDefaultTsconfigAppJson', () => {
    const config = getDefaultTsconfigAppJson()
    expect(config.compilerOptions?.target).toBe('ES2023')
    expect(config.compilerOptions?.types).toContain('miniprogram-api-typings')
    expect(config.compilerOptions?.lib).toEqual(['ES2023', 'DOM'])
    expect(config.extends).toBe('./tsconfig.shared.json')
    expect(config.compilerOptions?.paths?.['@/*']).toEqual(['../src/*'])
    expect(config.compilerOptions).not.toHaveProperty('baseUrl')
    expect(config.include).toContain('../src/**/*.ts')
    expect(config.compilerOptions?.noEmit).toBe(true)
  })

  it('getDefaultTsconfigAppJson follows custom srcRoot', () => {
    const config = getDefaultTsconfigAppJson({
      srcRoot: 'miniprogram',
    })

    expect(config.compilerOptions?.paths?.['@/*']).toEqual(['../miniprogram/*'])
    expect(config.include).toContain('../miniprogram/**/*.ts')
    expect(config.include).not.toContain('../src/**/*.ts')
  })

  it('getDefaultTsconfigAppJson supports root srcRoot', () => {
    const config = getDefaultTsconfigAppJson({
      srcRoot: '.',
    })

    expect(config.compilerOptions?.paths?.['@/*']).toEqual(['../*'])
    expect(config.include).toContain('../**/*.ts')
  })

  it('getDefaultTsconfigNodeJson', () => {
    const config = getDefaultTsconfigNodeJson(['vite.config.ts', 'vite.config.ts'])
    expect(config.extends).toBe('./tsconfig.shared.json')
    expect(config.compilerOptions?.types).toContain('node')
    expect(config.include).toContain('../vite.config.ts')
    expect(new Set(config.include ?? []).size).toBe((config.include ?? []).length)
  })

  it('getDefaultTsconfigSharedJson', () => {
    const config = getDefaultTsconfigSharedJson()

    expect(config.files).toEqual(['./tsconfig.shared.empty.d.ts'])
    expect(config.compilerOptions.noEmit).toBe(true)
  })

  it('getDefaultTsconfigServerJson', () => {
    const config = getDefaultTsconfigServerJson()

    expect(config.extends).toBe('./tsconfig.shared.json')
    expect(config.compilerOptions.types).toContain('node')
    expect(config.files).toEqual([])
  })
})
