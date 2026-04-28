import type { Resolver } from '../../../auto-import-components/resolvers'

import { fs } from '@weapp-core/shared/fs'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createResolverHelpers } from './resolver'

interface CreateStateOptions {
  cwd?: string
  configService?: any
  autoImportComponents?: any
}

function createState(options: CreateStateOptions = {}) {
  const { cwd = '/project', autoImportComponents = {}, configService } = options
  return {
    ctx: {
      configService: configService ?? {
        cwd,
        currentSubPackageRoot: undefined,
        weappViteConfig: {
          autoImportComponents,
        },
      },
    },
    registry: new Map<string, any>(),
    resolvedResolverComponents: new Map<string, string>(),
    componentMetadataMap: new Map<string, any>(),
    resolverComponentNames: new Set<string>(),
    resolverComponentsMapRef: { value: {} as Record<string, string> },
  } as any
}

async function createPackage(baseDir: string, packageName: string, packageJson: Record<string, any>, files: Record<string, string>) {
  const packageDir = path.join(baseDir, 'node_modules', ...packageName.split('/'))
  await fs.ensureDir(packageDir)
  await fs.writeJson(path.join(packageDir, 'package.json'), packageJson, { spaces: 2 })
  await Promise.all(
    Object.entries(files).map(async ([relativePath, content]) => {
      const target = path.join(packageDir, relativePath)
      await fs.ensureDir(path.dirname(target))
      await fs.writeFile(target, content)
    }),
  )
}

describe('autoImport resolver helpers', () => {
  let tempDirs: string[]

  beforeEach(() => {
    tempDirs = []
  })

  afterEach(async () => {
    await Promise.all(tempDirs.map(dir => fs.remove(dir)))
  })

  it('resolves with resolver.resolve and kebab-case fallback', () => {
    const resolver: Resolver = {
      resolve: vi.fn((componentName: string) => {
        if (componentName === 't-button') {
          return {
            name: 't-button',
            from: 'tdesign-miniprogram/button/button',
            sourceType: 'native',
          }
        }
        return undefined
      }),
    }

    const state = createState({
      autoImportComponents: {
        resolvers: [resolver],
      },
    })

    const helpers = createResolverHelpers(state)
    const resolved = helpers.resolveWithResolvers('TButton', '/project/src/pages/index/index')

    expect(resolved).toEqual({
      name: 'TButton',
      from: 'tdesign-miniprogram/button/button',
      sourceType: 'native',
    })
    expect((resolver as any).resolve).toHaveBeenCalledWith('TButton', '/project/src/pages/index/index')
    expect((resolver as any).resolve).toHaveBeenCalledWith('t-button', '/project/src/pages/index/index')
  })

  it('caches resolver hits and misses until reset', () => {
    const resolver = {
      resolve: vi.fn((componentName: string) => {
        if (componentName === 't-button') {
          return {
            name: 't-button',
            from: 'tdesign-miniprogram/button/button',
          }
        }
        return undefined
      }),
    } satisfies Resolver

    const state = createState({
      autoImportComponents: {
        resolvers: [resolver],
      },
    })

    const helpers = createResolverHelpers(state)

    expect(helpers.resolveWithResolvers('TButton', '/project/src/pages/index/index')).toEqual({
      name: 'TButton',
      from: 'tdesign-miniprogram/button/button',
    })
    expect(helpers.resolveWithResolvers('TButton', '/project/src/pages/index/index')).toEqual({
      name: 'TButton',
      from: 'tdesign-miniprogram/button/button',
    })
    expect(helpers.resolveWithResolvers('NotMatched', '/project/src/pages/index/index')).toBeUndefined()
    expect(helpers.resolveWithResolvers('NotMatched', '/project/src/pages/index/index')).toBeUndefined()

    expect(resolver.resolve).toHaveBeenCalledTimes(4)

    helpers.clearResolveCache()

    expect(helpers.resolveWithResolvers('TButton', '/project/src/pages/index/index')).toEqual({
      name: 'TButton',
      from: 'tdesign-miniprogram/button/button',
    })
    expect(resolver.resolve).toHaveBeenCalledTimes(6)
  })

  it('resolves with components map and function resolver fallback', () => {
    const functionResolver = vi.fn((componentName: string) => {
      if (componentName === 'x-foo') {
        return {
          name: 'XFoo',
          from: 'pkg/x-foo',
        }
      }
      return undefined
    }) as Resolver

    const state = createState({
      autoImportComponents: {
        resolvers: [
          {
            components: {
              'my-comp': 'pkg/my-comp',
            },
          },
          functionResolver,
        ],
      },
    })

    const helpers = createResolverHelpers(state)
    expect(helpers.resolveWithResolvers('MyComp')).toEqual({
      name: 'MyComp',
      from: 'pkg/my-comp',
    })

    expect(helpers.resolveWithResolvers('XFoo')).toEqual({
      name: 'XFoo',
      from: 'pkg/x-foo',
    })

    expect(functionResolver).toHaveBeenCalledWith('XFoo', '')
    expect(functionResolver).toHaveBeenCalledWith('x-foo', '')

    const noResolverState = createState({
      autoImportComponents: {
        globs: ['components/**/*.wxml'],
      },
    })
    const noResolverHelpers = createResolverHelpers(noResolverState)
    expect(noResolverHelpers.resolveWithResolvers('AnyComp')).toBeUndefined()
  })

  it('uses static component lookup when resolver declares static strategy', () => {
    const resolver = {
      componentLookupStrategy: 'static' as const,
      components: {
        't-button': 'tdesign-miniprogram/button/button',
      },
      resolve: vi.fn(() => {
        throw new Error('static resolver should not execute runtime resolve')
      }),
    } satisfies Resolver

    const state = createState({
      autoImportComponents: {
        resolvers: [resolver],
      },
    })

    const helpers = createResolverHelpers(state)

    expect(helpers.resolveWithResolvers('TButton', '/project/src/pages/index/index')).toEqual({
      name: 'TButton',
      from: 'tdesign-miniprogram/button/button',
    })
    expect(resolver.resolve).not.toHaveBeenCalled()
  })

  it('preserves resolver order when dynamic resolver appears before static resolver', () => {
    const dynamicResolver = {
      resolve: vi.fn((componentName: string) => {
        if (componentName === 't-button') {
          return {
            name: componentName,
            from: 'dynamic-first/t-button',
          }
        }
        return undefined
      }),
    } satisfies Resolver
    const staticResolver = {
      componentLookupStrategy: 'static' as const,
      components: {
        't-button': 'static-second/t-button',
      },
    } satisfies Resolver

    const state = createState({
      autoImportComponents: {
        resolvers: [dynamicResolver, staticResolver],
      },
    })

    const helpers = createResolverHelpers(state)

    expect(helpers.resolveWithResolvers('TButton', '/project/src/pages/index/index')).toEqual({
      name: 'TButton',
      from: 'dynamic-first/t-button',
    })
    expect(dynamicResolver.resolve).toHaveBeenCalled()
  })

  it('collects and syncs resolver component metadata', () => {
    const state = createState({
      autoImportComponents: {
        resolvers: [
          {
            components: {
              Keep: 'pkg/keep',
              NewOne: 'pkg/new-one',
            },
          },
          {
            components: {
              Keep: 'pkg/keep-override',
            },
          },
        ],
      },
    })

    state.resolvedResolverComponents.set('Keep', 'pkg/keep-override')
    state.resolvedResolverComponents.set('NewOne', 'pkg/new-one')

    state.registry.set('LocalOnly', {
      kind: 'local',
      value: { name: 'LocalOnly', from: '/components/local-only/index' },
      entry: {
        path: '/project/src/components/local-only/index.ts',
        json: { component: true },
        type: 'component',
        templatePath: '/project/src/components/local-only/index.wxml',
      },
    })

    state.componentMetadataMap.set('Keep', {
      types: new Map([['old', 'string']]),
      docs: new Map([['old', 'old']]),
    })
    state.componentMetadataMap.set('LocalOnly', {
      types: new Map([['local', 'string']]),
      docs: new Map([['local', 'local']]),
    })
    state.componentMetadataMap.set('Stale', {
      types: new Map([['stale', 'string']]),
      docs: new Map([['stale', 'stale']]),
    })

    const helpers = createResolverHelpers(state)
    expect(helpers.collectResolverComponents()).toEqual({
      Keep: 'pkg/keep-override',
      NewOne: 'pkg/new-one',
    })

    helpers.syncResolverComponentProps()

    expect(state.resolverComponentsMapRef.value).toEqual({
      Keep: 'pkg/keep-override',
      NewOne: 'pkg/new-one',
    })
    expect(Array.from(state.resolverComponentNames).sort()).toEqual(['Keep', 'NewOne'])
    expect(state.componentMetadataMap.has('Keep')).toBe(true)
    expect(state.componentMetadataMap.has('NewOne')).toBe(true)
    expect(state.componentMetadataMap.has('LocalOnly')).toBe(true)
    expect(state.componentMetadataMap.has('Stale')).toBe(false)
    expect(state.componentMetadataMap.get('NewOne')).toEqual({
      types: new Map(),
      docs: new Map(),
    })
  })

  it('collects full-strategy resolver components only for support files', () => {
    const state = createState({
      autoImportComponents: {
        resolvers: [
          {
            supportFilesStrategy: 'full',
            components: {
              'van-button': '@vant/weapp/button',
              'van-cell': '@vant/weapp/cell',
            },
          },
          {
            supportFilesStrategy: 'used',
            components: {
              't-button': 'tdesign-miniprogram/button/button',
            },
          },
          {
            components: {
              'mp-button': 'weui-miniprogram/button/button',
            },
          },
        ],
      },
    })

    const helpers = createResolverHelpers(state)

    expect(helpers.collectStaticResolverComponentsForSupportFiles()).toEqual({
      'van-button': '@vant/weapp/button',
      'van-cell': '@vant/weapp/cell',
    })

    helpers.setSupportFileResolverComponents({
      'van-button': '@vant/weapp/button',
      'van-cell': '@vant/weapp/cell',
    })

    expect(helpers.collectResolverComponents()).toEqual({
      'van-button': '@vant/weapp/button',
      'van-cell': '@vant/weapp/cell',
    })

    helpers.clearSupportFileResolverComponents()

    expect(helpers.collectResolverComponents()).toEqual({})
  })

  it('returns undefined for invalid navigation imports or missing cwd', () => {
    const noConfigServiceState = createState()
    noConfigServiceState.ctx.configService = { weappViteConfig: { autoImportComponents: {} } }
    expect(createResolverHelpers(noConfigServiceState).resolveNavigationImport('pkg/button')).toBeUndefined()

    const state = createState({
      autoImportComponents: {
        resolvers: [],
      },
    })
    const helpers = createResolverHelpers(state)

    expect(helpers.resolveNavigationImport('./local/path')).toBeUndefined()
    expect(helpers.resolveNavigationImport('/absolute/path')).toBeUndefined()
    expect(helpers.resolveNavigationImport('C:\\windows\\absolute')).toBeUndefined()
    expect(helpers.resolveNavigationImport('@scope-only')).toBeUndefined()
    expect(helpers.resolveNavigationImport('plain-package')).toBeUndefined()
  })

  it('returns undefined when resolver list cannot resolve target component', () => {
    const state = createState({
      autoImportComponents: {
        resolvers: [
          undefined as any,
          {},
          {
            components: {},
          },
          {
            resolve: () => undefined,
          },
        ],
      },
    })

    const helpers = createResolverHelpers(state)
    expect(helpers.collectResolverComponents()).toEqual({})
    expect(helpers.resolveWithResolvers('NotMatched', '/project/src/pages/index/index')).toBeUndefined()

    const invalidResolverConfigState = createState({
      autoImportComponents: {
        resolvers: {} as any,
      },
    })
    const invalidHelpers = createResolverHelpers(invalidResolverConfigState)
    expect(invalidHelpers.collectResolverComponents()).toEqual({})
    expect(invalidHelpers.resolveWithResolvers('StillNotMatched')).toBeUndefined()
  })

  it('resolves navigation import with miniprogram dts and js candidates', async () => {
    const tmpDir = await fs.mkdtemp(path.join(process.cwd(), '.tmp-resolver-'))
    tempDirs.push(tmpDir)

    await createPackage(
      tmpDir,
      '@scope/ui',
      {
        name: '@scope/ui',
        version: '1.0.0',
        miniprogram: 'miniprogram_dist',
      },
      {
        'miniprogram_dist/button/index.d.ts': 'export interface ButtonProps {}\n',
      },
    )

    await createPackage(
      tmpDir,
      'plain-ui',
      {
        name: 'plain-ui',
        version: '1.0.0',
      },
      {
        'button/index.js': 'module.exports = {}\n',
      },
    )

    const state = createState({
      cwd: tmpDir,
      autoImportComponents: {
        resolvers: [],
      },
    })
    const helpers = createResolverHelpers(state)

    expect(helpers.resolveNavigationImport('@scope/ui/button/index')).toBe('@scope/ui/miniprogram_dist/button/index')
    expect(helpers.resolveNavigationImport('plain-ui/button')).toBe('plain-ui/button')
    expect(helpers.resolveNavigationImport('plain-ui/button/index.js')).toBe('plain-ui/button/index.js')
    expect(helpers.resolveNavigationImport('missing-ui/button')).toBeUndefined()
  })

  it('keeps support-file resolver state stable when entries are unchanged', () => {
    const state = createState()
    const helpers = createResolverHelpers(state)

    helpers.setSupportFileResolverComponents({
      'van-button': '@vant/weapp/button',
    })
    const firstCollected = helpers.collectResolverComponents()

    helpers.setSupportFileResolverComponents({
      'van-button': '@vant/weapp/button',
    })

    expect(helpers.collectResolverComponents()).toEqual(firstCollected)

    helpers.clearSupportFileResolverComponents()
    expect(helpers.collectResolverComponents()).toEqual({})

    helpers.clearSupportFileResolverComponents()
    expect(helpers.collectResolverComponents()).toEqual({})
  })
})
