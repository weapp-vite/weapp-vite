import type { InlineConfig } from 'vite'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createAliasManager, normalizeAliasOptions } from './config/internal/alias'
import { resolveBuiltinPackageAliases } from './packageAliases'

const { existsSyncMock, getPackageInfoSyncMock, loggerWarnMock } = vi.hoisted(() => ({
  existsSyncMock: vi.fn(),
  getPackageInfoSyncMock: vi.fn(),
  loggerWarnMock: vi.fn(),
}))

vi.mock('node:fs', () => ({
  existsSync: existsSyncMock,
}))

vi.mock('./localPkg', () => ({
  safeGetPackageInfoSync: getPackageInfoSyncMock,
}))

vi.mock('../logger', () => ({
  default: {
    warn: loggerWarnMock,
  },
}))

describe('runtime package aliases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pins every wevu subpath to the nested compatible copy when the project resolves an older direct version', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string, options?: { paths?: string[] }) => {
      if (packageName === 'weapp-vite') {
        return {
          rootPath: '/project/node_modules/weapp-vite',
          version: '7.2.0',
          packageJson: { dependencies: { wevu: '7.2.0' } },
        }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/node_modules/weapp-vite/')) {
        return { rootPath: '/project/node_modules/weapp-vite/node_modules/wevu', version: '7.2.0' }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/app')) {
        return { rootPath: '/project/node_modules/wevu', version: '7.1.4' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    const aliases = resolveBuiltinPackageAliases({ cwd: '/project/app' })
    const wevuAliases = aliases.filter(alias => alias.find === 'wevu' || alias.find.startsWith('wevu/'))

    expect(wevuAliases).toHaveLength(10)
    expect(wevuAliases.every(alias => alias.replacement.startsWith('/project/node_modules/weapp-vite/node_modules/wevu/'))).toBe(true)
    expect(loggerWarnMock).toHaveBeenCalledTimes(1)
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('wevu@7.1.4'))
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('wevu@7.2.0'))
  })

  it('uses the compatible copy without warning when the direct wevu version already matches', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string, options?: { paths?: string[] }) => {
      if (packageName === 'weapp-vite') {
        return {
          rootPath: '/project/node_modules/weapp-vite',
          version: '7.2.0',
          packageJson: { dependencies: { wevu: '7.2.0' } },
        }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/node_modules/weapp-vite/')) {
        return { rootPath: '/project/node_modules/weapp-vite/node_modules/wevu', version: '7.2.0' }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/app')) {
        return { rootPath: '/project/node_modules/wevu', version: '7.2.0' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    const aliases = resolveBuiltinPackageAliases({ cwd: '/project/app' })

    expect(aliases).toContainEqual({
      find: 'wevu',
      replacement: '/project/node_modules/weapp-vite/node_modules/wevu/dist/index.mjs',
    })
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('resolves the compatible pnpm sibling copy without a nested node_modules directory', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string, options?: { paths?: string[] }) => {
      if (packageName === 'weapp-vite') {
        return {
          rootPath: '/project/node_modules/.pnpm/weapp-vite@7.2.0/node_modules/weapp-vite',
          version: '7.2.0',
          packageJson: { dependencies: { wevu: '7.2.0' } },
        }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.includes('/.pnpm/weapp-vite@7.2.0/node_modules/weapp-vite/')) {
        return { rootPath: '/project/node_modules/.pnpm/weapp-vite@7.2.0/node_modules/wevu', version: '7.2.0' }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/pnpm-app')) {
        return { rootPath: '/project/node_modules/wevu', version: '7.1.4' }
      }
      return undefined
    })
    existsSyncMock.mockImplementation((filePath: string) => filePath.endsWith('/dist/index.mjs'))

    const aliases = resolveBuiltinPackageAliases({ cwd: '/pnpm-app' })

    expect(aliases).toContainEqual({
      find: 'wevu',
      replacement: '/project/node_modules/.pnpm/weapp-vite@7.2.0/node_modules/wevu/dist/index.mjs',
    })
    expect(loggerWarnMock).toHaveBeenCalledWith(expect.stringContaining('wevu@7.1.4'))
  })

  it.each(['7.2.0', 'workspace:*'])('uses the declared wevu dependency %s when the builder has a newer patch version', (dependencyVersion) => {
    getPackageInfoSyncMock.mockImplementation((packageName: string, options?: { paths?: string[] }) => {
      if (packageName === 'weapp-vite') {
        return {
          rootPath: '/project/node_modules/weapp-vite',
          version: '7.2.1',
          packageJson: { dependencies: { wevu: dependencyVersion } },
        }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/node_modules/weapp-vite/')) {
        return { rootPath: '/project/node_modules/weapp-vite/node_modules/wevu', version: '7.2.0' }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/independent-patch-app')) {
        return { rootPath: '/project/node_modules/wevu', version: '7.1.4' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    const aliases = resolveBuiltinPackageAliases({ cwd: '/independent-patch-app' })

    expect(aliases).toContainEqual({
      find: 'wevu/internal-reactivity',
      replacement: '/project/node_modules/weapp-vite/node_modules/wevu/dist/internal-reactivity.mjs',
    })
  })

  it('rejects an incompatible hoisted candidate and retains the project fallback', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string, options?: { paths?: string[] }) => {
      if (packageName === 'weapp-vite') {
        return {
          rootPath: '/builder/node_modules/weapp-vite',
          version: '7.2.1',
          packageJson: { dependencies: { wevu: '7.2.0' } },
        }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/builder/node_modules/weapp-vite/')) {
        return { rootPath: '/builder/node_modules/wevu', version: '7.1.4' }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/fallback-app/')) {
        return { rootPath: '/project/fallback-app/node_modules/wevu', version: '7.2.0' }
      }
      return undefined
    })
    existsSyncMock.mockImplementation((filePath: string) => filePath.endsWith('/dist/index.mjs'))

    const aliases = resolveBuiltinPackageAliases({ cwd: '/project/fallback-app' })

    expect(aliases).toContainEqual({
      find: 'wevu',
      replacement: '/project/fallback-app/node_modules/wevu/dist/index.mjs',
    })
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('keeps the existing cwd and workspace fallback when no nested compatible copy is available', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string, options?: { paths?: string[] }) => {
      if (packageName === 'weapp-vite') {
        return {
          rootPath: '/project/node_modules/weapp-vite',
          version: '7.2.0',
          packageJson: { dependencies: { wevu: '7.2.0' } },
        }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/node_modules/weapp-vite/')) {
        return undefined
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/app')) {
        return { rootPath: '/project/node_modules/wevu', version: '7.1.4' }
      }
      return undefined
    })
    existsSyncMock.mockImplementation((filePath: string) => filePath.endsWith('/dist/index.mjs'))

    const aliases = resolveBuiltinPackageAliases({ cwd: '/project/app' })

    expect(aliases).toContainEqual({
      find: 'wevu',
      replacement: '/project/node_modules/wevu/dist/index.mjs',
    })
    expect(loggerWarnMock).not.toHaveBeenCalled()
  })

  it('emits the version preflight warning only once for the same mismatch', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string, options?: { paths?: string[] }) => {
      if (packageName === 'weapp-vite') {
        return {
          rootPath: '/project/node_modules/weapp-vite',
          version: '7.2.0',
          packageJson: { dependencies: { wevu: '7.2.0' } },
        }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/node_modules/weapp-vite/')) {
        return { rootPath: '/project/node_modules/weapp-vite/node_modules/wevu', version: '7.2.0' }
      }
      if (packageName === 'wevu' && options?.paths?.[0]?.startsWith('/project/warning-app')) {
        return { rootPath: '/project/node_modules/wevu', version: '7.1.4' }
      }
      return undefined
    })
    existsSyncMock.mockReturnValue(true)

    resolveBuiltinPackageAliases({ cwd: '/project/warning-app' })
    resolveBuiltinPackageAliases({ cwd: '/project/warning-app' })

    expect(loggerWarnMock).toHaveBeenCalledTimes(1)
    expect(loggerWarnMock).toHaveBeenCalledWith('[weapp-vite] 检测到项目解析到 wevu@7.1.4，与 weapp-vite 配套的 wevu@7.2.0 不一致，已自动采用兼容副本。建议执行 pnpm update weapp-vite wevu。')
  })

  it('adds built file aliases and resolves vue-demi to an absolute entry', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string) => {
      if (packageName === '@weapp-core/shared') {
        return { rootPath: '/project/node_modules/@weapp-core/shared' }
      }
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

    expect(aliases).toHaveLength(14)
    expect(aliases).toEqual(expect.arrayContaining([
      {
        find: '@weapp-core/shared/platforms',
        replacement: '/project/node_modules/@weapp-core/shared/dist/platforms/index.js',
      },
      {
        find: '@weapp-core/shared/platforms/runtime',
        replacement: '/project/node_modules/@weapp-core/shared/dist/platforms/runtime/index.js',
      },
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
    expect(aliases.map(alias => alias.find)).not.toEqual(expect.arrayContaining([
      'wevu/jsx-runtime',
      'wevu/weapp/jsx-runtime',
      'wevu/alipay/jsx-runtime',
      'wevu/tt/jsx-runtime',
      'wevu/miniprogram/jsx-runtime',
    ]))
    expect(existsSyncMock).not.toHaveBeenCalledWith(expect.stringMatching(/jsx-runtime/))

    const config: InlineConfig = {}
    createAliasManager({ find: /^~oxc\//, replacement: '/project/.oxc' }, aliases).injectBuiltinAliases(config)
    const runtimeImport = '@weapp-core/shared/platforms/runtime'
    const matched = normalizeAliasOptions(config.resolve?.alias).find(alias =>
      typeof alias.find === 'string' && (runtimeImport === alias.find || runtimeImport.startsWith(`${alias.find}/`)),
    )
    expect(matched?.replacement).toBe('/project/node_modules/@weapp-core/shared/dist/platforms/runtime/index.js')
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

  it('falls back to development dist entries when published wevu packages do not include source files', () => {
    getPackageInfoSyncMock.mockImplementation((packageName: string) => {
      if (packageName === 'wevu') {
        return { rootPath: '/project/node_modules/wevu' }
      }
      return undefined
    })
    existsSyncMock.mockImplementation((filePath: string) =>
      /\/project\/node_modules\/wevu\/dist\/dev\/(?:index|compiler|internal-reactivity|internal-runtime|internal-template|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
    )

    const aliases = resolveBuiltinPackageAliases({ isDev: true })

    expect(aliases).toEqual(expect.arrayContaining([
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

  it('resolves packages and workspace fallbacks from the target project cwd', () => {
    getPackageInfoSyncMock.mockReturnValue(undefined)
    existsSyncMock.mockImplementation((filePath: string) =>
      filePath === '/worktrees/feature/pnpm-workspace.yaml'
      || /\/worktrees\/feature\/packages-runtime\/wevu\/dist\/(?:index|compiler|internal-reactivity|internal-runtime|internal-template|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
    )

    const aliases = resolveBuiltinPackageAliases({ cwd: '/worktrees/feature/apps/demo' })

    expect(getPackageInfoSyncMock).toHaveBeenCalledWith('wevu', {
      paths: ['/worktrees/feature/apps/demo/.weapp-vite-package-resolution.mjs'],
    })
    expect(aliases).toContainEqual({
      find: 'wevu/internal-reactivity',
      replacement: '/worktrees/feature/packages-runtime/wevu/dist/internal-reactivity.mjs',
    })
  })

  it('falls back to the owning workspace when the target project is outside a workspace', () => {
    getPackageInfoSyncMock.mockReturnValue(undefined)
    existsSyncMock.mockImplementation((filePath: string) =>
      (!filePath.startsWith('/external/project') && filePath.endsWith('/pnpm-workspace.yaml'))
      || /\/packages-runtime\/wevu\/dist\/(?:index|compiler|internal-reactivity|internal-runtime|internal-template|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
    )

    const aliases = resolveBuiltinPackageAliases({ cwd: '/external/project' })

    expect(aliases).toContainEqual(expect.objectContaining({
      find: 'wevu/internal-runtime',
      replacement: expect.stringMatching(/packages-runtime\/wevu\/dist\/internal-runtime\.mjs$/),
    }))
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
      || /\/packages-runtime\/wevu\/dist\/(?:index|compiler|internal-reactivity|internal-runtime|internal-template|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
    )

    const aliases = resolveBuiltinPackageAliases()

    expect(aliases).toHaveLength(12)
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

  it('uses one workspace development dist graph in dev mode', () => {
    getPackageInfoSyncMock.mockReturnValue(undefined)
    existsSyncMock.mockImplementation((filePath: string) =>
      filePath.endsWith('/pnpm-workspace.yaml')
      || /\/packages-runtime\/wevu\/dist\/dev\/(?:index|compiler|internal-reactivity|internal-runtime|internal-template|store|api|fetch|router|web-apis|vue-demi)\.mjs$/.test(filePath),
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
