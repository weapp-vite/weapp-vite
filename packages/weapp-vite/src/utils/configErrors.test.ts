import { describe, expect, it } from 'vitest'
import { createCjsConfigLoadError, formatConfigPath } from './configErrors'

describe('createCjsConfigLoadError', () => {
  const cwd = '/project'

  it('formats config paths relative to cwd when possible', () => {
    expect(formatConfigPath(undefined, cwd)).toBe('vite.config.ts')
    expect(formatConfigPath('/project/vite.config.ts', cwd)).toBe('vite.config.ts')
    expect(formatConfigPath('/project/config/vite.config.ts', cwd)).toBe('config/vite.config.ts')
    expect(formatConfigPath('/another/vite.config.ts', cwd)).toBe('/another/vite.config.ts')
  })

  it('returns undefined when error text does not match CJS patterns', () => {
    const error = createCjsConfigLoadError({
      error: new Error('Unexpected token'),
      configPath: '/project/vite.config.ts',
      cwd,
    })

    expect(error).toBeUndefined()
  })

  it('creates ESM guidance error with relative config path', () => {
    const source = new Error('ReferenceError: __dirname is not defined')
    const error = createCjsConfigLoadError({
      error: source,
      configPath: '/project/vite.config.ts',
      cwd,
    })

    expect(error).toBeInstanceOf(Error)
    expect(error?.message).toBe('vite.config.ts 为 CJS 格式，需要改为 ESM 写法（可参考 import.meta.dirname 等用法）。')
    expect((error as Error & { cause?: unknown }).cause).toBe(source)
  })

  it('uses default config name when path is missing', () => {
    const error = createCjsConfigLoadError({
      error: 'module is not defined',
      cwd,
    })

    expect(error?.message).toBe('vite.config.ts 为 CJS 格式，需要改为 ESM 写法（可参考 import.meta.dirname 等用法）。')
  })

  it('keeps absolute path when config is outside cwd', () => {
    const error = createCjsConfigLoadError({
      error: 'exports is not defined',
      configPath: '/another/vite.config.ts',
      cwd,
    })

    expect(error?.message).toBe('/another/vite.config.ts 为 CJS 格式，需要改为 ESM 写法（可参考 import.meta.dirname 等用法）。')
  })

  it('collects nested object/cause/stack text for detection', () => {
    const error = createCjsConfigLoadError({
      error: {
        message: 'outer message',
        stack: 'Error: es module scope',
        cause: {
          message: 'inner cause',
        },
      },
      configPath: '/project/config/vite.config.ts',
      cwd,
    })

    expect(error?.message).toBe('config/vite.config.ts 为 CJS 格式，需要改为 ESM 写法（可参考 import.meta.dirname 等用法）。')
  })
})
