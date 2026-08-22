import { createLogicalEntryId, createSidecarSourceSpecifier } from '../moduleGraph/protocol'
import {
  createPreserveModuleMatcher,
  createPreserveModulesGroup,
  normalizePreserveModulesRolldownOptions,
  resolvePreservedModuleName,
} from './preserveModules'

function createConfigService(patterns: (string | RegExp)[] = ['utils/**']) {
  return {
    absoluteSrcRoot: '/project/src',
    relativeAbsoluteSrcRoot(id: string) {
      return id.startsWith('/project/src/') ? id.slice('/project/src/'.length) : id
    },
    weappViteConfig: {
      chunks: {
        preserveModules: patterns,
      },
    },
  } as any
}

describe('preserveModules', () => {
  it('matches srcRoot-relative paths and resets regexp state', () => {
    const matches = createPreserveModuleMatcher(['utils/**', /services\/.+\.ts$/g])

    expect(matches?.('utils/single.ts', '/project/src/utils/single.ts')).toBe(true)
    expect(matches?.('services/single.ts', '/project/src/services/single.ts')).toBe(true)
    expect(matches?.('services/single.ts', '/project/src/services/single.ts')).toBe(true)
    expect(matches?.('pages/index.ts', '/project/src/pages/index.ts')).toBe(false)
    expect(createPreserveModuleMatcher()).toBeUndefined()
    expect(createPreserveModuleMatcher([{} as never])).toBeUndefined()
  })

  it('creates a high-priority non-recursive Rolldown group', () => {
    const group = createPreserveModulesGroup(createConfigService(), () => [])

    expect(group).toMatchObject({
      priority: 100,
      minShareCount: 1,
      minSize: 0,
      minModuleSize: 0,
      includeDependenciesRecursively: false,
    })
    expect(group?.test?.('/project/src/utils/single.ts')).toBe(true)
    expect(group?.test?.('/project/src/pages/index.ts')).toBe(false)
  })

  it('uses a compatible entry signature without overriding an explicit false value', () => {
    const configService = createConfigService()
    const defaults = normalizePreserveModulesRolldownOptions(configService, {
      preserveEntrySignatures: 'exports-only',
    })
    const explicitFalse = normalizePreserveModulesRolldownOptions(configService, {
      preserveEntrySignatures: false,
    })

    expect(defaults.preserveEntrySignatures).toBe('allow-extension')
    expect(explicitFalse.preserveEntrySignatures).toBe(false)
    expect(normalizePreserveModulesRolldownOptions(configService, {
      preserveEntrySignatures: 'strict',
    }).preserveEntrySignatures).toBe('strict')
    expect(normalizePreserveModulesRolldownOptions(createConfigService([]), {
      preserveEntrySignatures: 'exports-only',
    }).preserveEntrySignatures).toBe('exports-only')
  })

  it('preserves physical modules by srcRoot-relative path', () => {
    const id = '/project/src/utils/single.ts'
    const name = resolvePreservedModuleName({
      configService: createConfigService(),
      ctx: {
        getModuleInfo: () => ({ importers: ['/project/src/pages/index.ts'] }),
      },
      getSubPackageRoots: () => [],
      id,
    })

    expect(name).toBe('utils/single')
  })

  it('does not capture logical entry sources, sidecars, or external modules', () => {
    const configService = createConfigService(['**'])
    const pageId = '/project/src/pages/index.ts'
    const pageEntryId = createLogicalEntryId(pageId, 'page')
    const resolve = (id: string, importers: string[] = []) => resolvePreservedModuleName({
      configService,
      ctx: { getModuleInfo: () => ({ importers }) },
      getSubPackageRoots: () => [],
      id,
    })

    expect(resolve(pageId, [pageEntryId])).toBeUndefined()
    expect(resolve(createSidecarSourceSpecifier(pageId, pageId, 'style'))).toBeUndefined()
    expect(resolve('/project/node_modules/pkg/index.js')).toBeUndefined()
  })

  it('normalizes file URLs, Vite prefixes, query strings and source extensions', () => {
    const configService = createConfigService(['utils/**'])
    const resolve = (id: string) => resolvePreservedModuleName({
      configService,
      ctx: { getModuleInfo: () => ({ importers: ['/project/src/pages/index.ts'] }) },
      getSubPackageRoots: () => [],
      id,
    })

    expect(resolve('file:///project/src/utils/deep/item.test.ts?raw')).toBe('utils/deep/item')
    expect(resolve('/@fs//project/src/utils/single.ts?v=1')).toBe('utils/single')
    expect(resolve('/project/src')).toBeUndefined()
    expect(resolve('utils/single.ts')).toBeUndefined()
  })

  it('keeps subpackage boundary validation for preserved modules', () => {
    expect(() => resolvePreservedModuleName({
      configService: createConfigService(['packageA/**']),
      ctx: {
        getModuleInfo: () => ({ importers: ['/project/src/packageB/pages/index.ts'] }),
      },
      getSubPackageRoots: () => ['packageA', 'packageB'],
      id: '/project/src/packageA/utils/single.ts',
    })).toThrow(/位于分包 "packageA"/)
  })
})
