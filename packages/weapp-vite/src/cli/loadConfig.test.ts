import process from 'node:process'
import path from 'pathe'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { loadConfig } from './loadConfig'

const loadViteConfigFileMock = vi.hoisted(() => vi.fn())
const resolveWeappConfigFileMock = vi.hoisted(() => vi.fn())
const createCjsConfigLoadErrorMock = vi.hoisted(() => vi.fn())

vi.mock('../utils', () => ({
  createCjsConfigLoadError: createCjsConfigLoadErrorMock,
  loadViteConfigFile: loadViteConfigFileMock,
  resolveWeappConfigFile: resolveWeappConfigFileMock,
}))

describe('loadConfig', () => {
  beforeEach(() => {
    loadViteConfigFileMock.mockReset()
    resolveWeappConfigFileMock.mockReset()
    createCjsConfigLoadErrorMock.mockReset()
    createCjsConfigLoadErrorMock.mockReturnValue(undefined)
  })

  it('prints ESM guidance when the main config uses CJS globals', async () => {
    const originalError = new Error('ReferenceError: __dirname is not defined')
    const wrappedError = new Error('cjs wrapped')
    loadViteConfigFileMock.mockRejectedValueOnce(originalError)
    createCjsConfigLoadErrorMock.mockReturnValueOnce(wrappedError)

    await expect(loadConfig('vite.config.ts')).rejects.toThrow('cjs wrapped')
    expect(createCjsConfigLoadErrorMock).toHaveBeenCalledWith(expect.objectContaining({
      error: originalError,
      configPath: path.resolve(process.cwd(), 'vite.config.ts'),
    }))
  })

  it('returns the loaded vite config when no weapp config file is found', async () => {
    loadViteConfigFileMock.mockResolvedValueOnce({
      config: {
        define: {
          A: '1',
        },
      },
      path: '/project/vite.config.ts',
      dependencies: ['/project/vite.config.ts'],
    })
    resolveWeappConfigFileMock.mockResolvedValueOnce(undefined)

    const result = await loadConfig('vite.config.ts')
    expect(result).toEqual({
      config: {
        define: {
          A: '1',
        },
      },
      path: '/project/vite.config.ts',
      dependencies: ['/project/vite.config.ts'],
    })
    expect(loadViteConfigFileMock).toHaveBeenCalledWith(
      { command: 'serve', mode: 'development' },
      path.resolve(process.cwd(), 'vite.config.ts'),
      process.cwd(),
      undefined,
      undefined,
      'runner',
    )
  })

  it('reuses the first load result when vite and weapp config paths are identical', async () => {
    loadViteConfigFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          a: 1,
        },
      },
      path: '/project/weapp-vite.config.ts',
      dependencies: ['/project/weapp-vite.config.ts'],
    })
    resolveWeappConfigFileMock.mockResolvedValueOnce('/project/weapp-vite.config.ts')

    const result = await loadConfig('/project/weapp-vite.config.ts')
    expect(loadViteConfigFileMock).toHaveBeenCalledTimes(1)
    expect(result?.path).toBe('/project/weapp-vite.config.ts')
    expect(result?.config.weapp).toEqual({
      a: 1,
    })
  })

  it('merges weapp config and dedupes dependencies when both configs are loaded', async () => {
    loadViteConfigFileMock
      .mockResolvedValueOnce({
        config: {
          define: {
            A: '1',
          },
          weapp: {
            fromVite: true,
            overwrite: 'vite',
          },
        },
        path: '/project/vite.config.ts',
        dependencies: ['/project/shared.ts', '/project/vite.config.ts'],
      })
      .mockResolvedValueOnce({
        config: {
          weapp: {
            overwrite: 'weapp',
            extra: true,
          },
        },
        path: '/project/weapp-vite.config.ts',
        dependencies: ['/project/shared.ts', '/project/weapp-vite.config.ts'],
      })
    resolveWeappConfigFileMock.mockResolvedValueOnce('/project/weapp-vite.config.ts')

    const result = await loadConfig('/project/vite.config.ts')
    expect(result?.path).toBe('/project/weapp-vite.config.ts')
    expect(result?.config.weapp).toEqual({
      overwrite: 'weapp',
      extra: true,
      fromVite: true,
    })
    expect(result?.dependencies).toEqual([
      '/project/shared.ts',
      '/project/vite.config.ts',
      '/project/weapp-vite.config.ts',
    ])
  })

  it('returns undefined when neither config can be loaded', async () => {
    loadViteConfigFileMock.mockResolvedValueOnce(undefined)
    resolveWeappConfigFileMock.mockResolvedValueOnce(undefined)

    await expect(loadConfig('/project/vite.config.ts')).resolves.toBeUndefined()
  })

  it('wraps CJS errors from loading weapp config file', async () => {
    loadViteConfigFileMock
      .mockResolvedValueOnce({
        config: {
          define: {
            A: '1',
          },
        },
        path: '/project/vite.config.ts',
        dependencies: [],
      })
      .mockRejectedValueOnce(new Error('module is not defined'))
    resolveWeappConfigFileMock.mockResolvedValueOnce('/project/weapp-vite.config.ts')
    createCjsConfigLoadErrorMock.mockReturnValueOnce(new Error('weapp cjs wrapped'))

    await expect(loadConfig('/project/vite.config.ts')).rejects.toThrow('weapp cjs wrapped')
  })

  it('does not merge root weapp config when an explicit custom config file is passed', async () => {
    loadViteConfigFileMock.mockResolvedValueOnce({
      config: {
        weapp: {
          lib: {
            entry: 'src/index.ts',
          },
        },
      },
      path: '/project/weapp-vite.lib.config.ts',
      dependencies: ['/project/weapp-vite.lib.config.ts'],
    })
    resolveWeappConfigFileMock.mockResolvedValueOnce(undefined)

    const result = await loadConfig('/project/weapp-vite.lib.config.ts')

    expect(loadViteConfigFileMock).toHaveBeenCalledTimes(1)
    expect(result?.path).toBe('/project/weapp-vite.lib.config.ts')
    expect(result?.config.weapp).toEqual({
      lib: {
        entry: 'src/index.ts',
      },
    })
  })
})
