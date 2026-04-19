import { beforeEach, describe, expect, it, vi } from 'vitest'
import { resolveBuiltinPackageAliases } from './packageAliases'

const { existsSyncMock, getPackageInfoSyncMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  getPackageInfoSyncMock: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}))

vi.mock('local-pkg', () => ({
  getPackageInfoSync: getPackageInfoSyncMock,
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

    expect(aliases).toHaveLength(10)
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
        find: 'wevu/web-apis',
        replacement: '/project/node_modules/wevu/dist/web-apis.mjs',
      },
      {
        find: 'vue-demi',
        replacement: '/project/node_modules/wevu/dist/vue-demi.mjs',
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
      || /\/packages-runtime\/wevu\/dist\/(?:index|compiler|jsx-runtime|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
    )

    const aliases = resolveBuiltinPackageAliases()

    expect(aliases).toHaveLength(10)
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
        find: 'wevu/web-apis',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/web-apis\.mjs$/),
      }),
      expect.objectContaining({
        find: 'vue-demi',
        replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/vue-demi\.mjs$/),
      }),
    ]))
  })
})
