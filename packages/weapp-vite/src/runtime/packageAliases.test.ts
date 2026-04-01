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

  it('adds built file aliases and vue-demi compatibility alias', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string) => {
      if (packageName === 'class-variance-authority') {
        return { rootPath: '/project/node_modules/class-variance-authority' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    expect(resolveBuiltinPackageAliases()).toEqual([
      {
        find: 'class-variance-authority',
        replacement: '/project/node_modules/class-variance-authority/dist/index.js',
      },
      {
        find: 'vue-demi',
        replacement: 'wevu/vue-demi',
      },
    ])
  })
})
