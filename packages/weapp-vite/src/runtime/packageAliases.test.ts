import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveBuiltinPackageAliases } from './packageAliases'

const { existsSyncMock, getPackageInfoSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  getPackageInfoSyncMock: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}))

vi.mock('./localPkg', () => ({
  safeGetPackageInfoSync: getPackageInfoSyncMock,
}))

describe('runtime package aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('adds built file aliases and resolves vue-demi to an absolute entry', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string) => {
      if (packageName === 'class-variance-authority') {
        return { rootPath: '/project/node_modules/class-variance-authority' }
      }
      if (packageName === 'wevu') {
        return { rootPath: '/project/node_modules/wevu' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    const aliases = resolveBuiltinPackageAliases()

    expect(aliases).toHaveLength(13)
    expect(aliases).toEqual(expect.arrayContaining([
      {
        find: 'class-variance-authority',
        replacement: '/project/node_modules/class-variance-authority/dist/index.js',
      },
      {
        find: 'wevu',
        replacement: '/project/node_modules/wevu/dist/index.mjs',
      },
      {
        find: 'wevu/router',
        replacement: '/project/node_modules/wevu/dist/router.mjs',
      },
      {
        find: 'wevu/internal-runtime',
        replacement: '/project/node_modules/wevu/dist/internal-runtime.mjs',
      },
      {
        find: 'wevu/internal-reactivity',
        replacement: '/project/node_modules/wevu/dist/internal-reactivity.mjs',
      },
      {
        find: 'wevu/internal-template',
        replacement: '/project/node_modules/wevu/dist/internal-template.mjs',
      },
      {
        find: 'wevu/web-apis',
        replacement: '/project/node_modules/wevu/dist/web-apis.mjs',
      },
      {
        find: 'vue-demi',
        replacement: '/project/node_modules/wevu/dist/vue-demi.mjs',
      },
    ]))
  })

  it('uses development wevu entries in dev mode by default', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string) => {
      if (packageName === 'class-variance-authority') {
        return { rootPath: '/project/node_modules/class-variance-authority' }
      }
      if (packageName === 'wevu') {
        return { rootPath: '/project/node_modules/wevu' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    const aliases = resolveBuiltinPackageAliases({ isDev: true })

    expect(aliases).toEqual(expect.arrayContaining([
      {
        find: 'wevu',
        replacement: '/project/node_modules/wevu/dist/dev/index.mjs',
      },
      {
        find: 'wevu/compiler',
        replacement: '/project/node_modules/wevu/dist/dev/compiler.mjs',
      },
      {
        find: 'wevu/internal-runtime',
        replacement: '/project/node_modules/wevu/dist/dev/internal-runtime.mjs',
      },
      {
        find: 'wevu/internal-reactivity',
        replacement: '/project/node_modules/wevu/dist/dev/internal-reactivity.mjs',
      },
      {
        find: 'wevu/internal-template',
        replacement: '/project/node_modules/wevu/dist/dev/internal-template.mjs',
      },
      {
        find: 'wevu/router',
        replacement: '/project/node_modules/wevu/dist/dev/router.mjs',
      },
      {
        find: 'vue-demi',
        replacement: '/project/node_modules/wevu/dist/dev/vue-demi.mjs',
      },
    ]))
  })

  it('allows forcing the wevu runtime entry mode', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string) => {
      if (packageName === 'wevu') {
        return { rootPath: '/project/node_modules/wevu' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    const buildAliases = resolveBuiltinPackageAliases({ isDev: true, wevuRuntime: 'build' })
    const devAliases = resolveBuiltinPackageAliases({ isDev: false, wevuRuntime: 'dev' })

    expect(buildAliases).toEqual(expect.arrayContaining([
      {
        find: 'wevu',
        replacement: '/project/node_modules/wevu/dist/index.mjs',
      },
    ]))
    expect(devAliases).toEqual(expect.arrayContaining([
      {
        find: 'wevu',
        replacement: '/project/node_modules/wevu/dist/dev/index.mjs',
      },
    ]))
  })

  it('falls back to workspace dist entry when workspace package lookup is unavailable', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string) => {
      if (packageName === 'class-variance-authority') {
        return { rootPath: '/project/node_modules/class-variance-authority' }
      }
      return undefined
    })
    existsSyncMock.mockImplementation((filePath: string) =>
      filePath === '/project/node_modules/class-variance-authority/dist/index.js'
      || filePath.endsWith('/pnpm-workspace.yaml')
      || /\/packages-runtime\/wevu\/dist\/(?:index|compiler|internal-reactivity|internal-runtime|internal-template|jsx-runtime|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
    )

    const aliases = resolveBuiltinPackageAliases()

    expect(aliases).toHaveLength(13)
    expect(aliases).toEqual(expect.arrayContaining([
      {
        find: 'class-variance-authority',
        replacement: '/project/node_modules/class-variance-authority/dist/index.js',
      },
      expect.objectContaining({
        find: 'wevu',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/index\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/api',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/api\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/internal-runtime',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/internal-runtime\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/internal-reactivity',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/internal-reactivity\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/internal-template',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/internal-template\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/web-apis',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/web-apis\.mjs$/),
      }),
      expect.objectContaining({
        find: 'vue-demi',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/vue-demi\.mjs$/),
      }),
    ]))
  })

  it('falls back to workspace development dist entry in dev mode', () => {
    getPackageInfoSyncMock.mockReturnValue(undefined)
    existsSyncMock.mockImplementation((filePath: string) =>
      filePath.endsWith('/pnpm-workspace.yaml')
      || /\/packages-runtime\/wevu\/dist\/dev\/(?:index|compiler|internal-reactivity|internal-runtime|internal-template|jsx-runtime|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
    )

    const aliases = resolveBuiltinPackageAliases({ isDev: true })

    expect(aliases).toEqual(expect.arrayContaining([
      expect.objectContaining({
        find: 'wevu',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/dev\/index\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/api',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/dev\/api\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/internal-runtime',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/dev\/internal-runtime\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/internal-reactivity',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/dev\/internal-reactivity\.mjs$/),
      }),
      expect.objectContaining({
        find: 'wevu/internal-template',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/dev\/internal-template\.mjs$/),
      }),
      expect.objectContaining({
        find: 'vue-demi',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/dev\/vue-demi\.mjs$/),
      }),
    ]))
  })
})
