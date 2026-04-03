import type { ConfigService } from './config/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../context/shared'
import { __clearSharedChunkDiagnosticsForTest } from './chunkStrategy'
import {
  createForceDuplicateTester,
  createSharedBuildConfig,
  createSharedBuildOutput,
  createSharedModeResolver,
  createSharedPathResolver,
  createStringOrRegExpMatcher,
  normalizeSharedPathCandidate,
  resolveNodeModulesSharedPath,
  resolveSharedBuildChunksOptions,
  resolveSharedPathRoot,
} from './sharedBuildConfig'

function createConfigService(chunks: Record<string, unknown> = {}): ConfigService {
  return {
    cwd: '/project',
    absoluteSrcRoot: '/project/src',
    relativeAbsoluteSrcRoot: (id: string) => {
      if (id.startsWith('/project/src/')) {
        return id.slice('/project/src/'.length)
      }
      if (id.startsWith('/project/')) {
        return id.slice('/project/'.length)
      }
      return id
    },
    weappViteConfig: {
      chunks,
    },
  } as unknown as ConfigService
}

function createChunkNameResolver(chunks: Record<string, unknown> = {}) {
  const output = createSharedBuildOutput(createConfigService(chunks), () => ['packageA', 'packageB'])
  return output.codeSplitting.groups[0].name
}

afterEach(() => {
  __clearSharedChunkDiagnosticsForTest()
  vi.restoreAllMocks()
})

describe('sharedBuildConfig', () => {
  it('creates string and regexp matchers with reset lastIndex behavior', () => {
    const stringMatcher = createStringOrRegExpMatcher('shared/**')
    const regexpMatcher = createStringOrRegExpMatcher(/shared\/.+\.ts$/g)

    expect(stringMatcher?.('shared/feature.ts')).toBe(true)
    expect(stringMatcher?.('pages/index.ts')).toBe(false)

    regexpMatcher?.('shared/feature.ts')
    expect(regexpMatcher?.('shared/feature.ts')).toBe(true)
    expect(createStringOrRegExpMatcher({} as never)).toBeUndefined()
  })

  it('returns undefined duplicate tester and shared mode resolver when no valid matchers exist', () => {
    expect(createForceDuplicateTester()).toBeUndefined()
    expect(createForceDuplicateTester([])).toBeUndefined()
    expect(createForceDuplicateTester([{} as never])).toBeUndefined()

    expect(createSharedModeResolver('common')).toBeUndefined()
    expect(createSharedModeResolver('common', [])).toBeUndefined()
    expect(createSharedModeResolver('common', [
      { test: {} as never, mode: 'path' },
    ])).toBeUndefined()
  })

  it('resolves shared path root inside src root and normalizes vite ids', () => {
    expect(resolveSharedPathRoot(
      createConfigService(),
      'src/shared',
    ).resolvedRoot).toBe('/project/src/shared')
    expect(resolveSharedPathRoot(
      createConfigService(),
      '../outside-src',
    ).resolvedRoot).toBe('/project/src')

    expect(normalizeSharedPathCandidate('\0/@fs//project/src/shared/feature.ts?import')).toBe('/@fs//project/src/shared/feature.ts')
  })

  it('returns undefined for non-absolute or outside-root shared path candidates', () => {
    const resolveSharedPath = createSharedPathResolver(createConfigService({
      sharedPathRoot: 'src/shared',
    }), 'src/shared')

    expect(resolveSharedPath('shared/feature.ts')).toBeUndefined()
    expect(resolveSharedPath('/project/src/pages/index.ts')).toBeUndefined()
    expect(resolveSharedPath('/external/workspace/feature.ts')).toBeUndefined()
  })

  it('normalizes node_modules paths without leaking the node_modules segment', () => {
    expect(resolveNodeModulesSharedPath('/project/node_modules/fake-pkg/index.js')).toBe('fake-pkg/index.js')
    expect(resolveNodeModulesSharedPath('/project/node_modules/.pnpm/@scope+pkg@1.0.0/node_modules/@scope/pkg/dist/index.mjs'))
      .toBe('@scope/pkg/dist/index.mjs')
    expect(resolveNodeModulesSharedPath('/project/src/shared/feature.ts')).toBeUndefined()
  })

  it('resolves chunk options with defaults and overrides', () => {
    expect(resolveSharedBuildChunksOptions(createConfigService())).toEqual({
      sharedStrategy: 'hoist',
      forceDuplicatePatterns: undefined,
      sharedMode: 'common',
      sharedOverrides: undefined,
      sharedPathRoot: undefined,
    })

    expect(resolveSharedBuildChunksOptions(createConfigService({
      sharedStrategy: 'duplicate',
      forceDuplicatePatterns: ['shared/**'],
      sharedMode: 'path',
      sharedOverrides: [{ test: 'shared/**', mode: 'inline' }],
      sharedPathRoot: 'src/shared',
    }))).toEqual({
      sharedStrategy: 'duplicate',
      forceDuplicatePatterns: ['shared/**'],
      sharedMode: 'path',
      sharedOverrides: [{ test: 'shared/**', mode: 'inline' }],
      sharedPathRoot: 'src/shared',
    })
  })

  it('returns undefined for path mode when there is only one importer', () => {
    const resolveName = createChunkNameResolver({
      sharedMode: 'path',
    })

    const result = resolveName('/project/src/shared/feature.ts', {
      getModuleInfo: () => ({
        importers: ['/project/src/pages/index/index.ts'],
      }),
    })

    expect(result).toBeUndefined()
  })

  it('uses sharedPathRoot to shorten path-mode chunk names', () => {
    const resolveName = createChunkNameResolver({
      sharedMode: 'path',
      sharedPathRoot: 'src/shared',
    })

    const result = resolveName('/project/src/shared/deep/feature.ts', {
      getModuleInfo: () => ({
        importers: [
          '/project/src/pages/index/index.ts',
          '/project/src/packageA/pages/foo.ts',
        ],
      }),
    })

    expect(result).toBe('deep/feature')
  })

  it('falls back to srcRoot when sharedPathRoot is outside srcRoot', () => {
    const warnSpy = vi.spyOn(logger, 'warn').mockImplementation(() => {})
    const resolveName = createChunkNameResolver({
      sharedMode: 'path',
      sharedPathRoot: '../outside-src',
    })

    const result = resolveName('/project/src/shared/feature.ts', {
      getModuleInfo: () => ({
        importers: [
          '/project/src/pages/index/index.ts',
          '/project/src/packageA/pages/foo.ts',
        ],
      }),
    })

    expect(result).toBe('shared/feature')
    expect(warnSpy).toHaveBeenCalledWith(expect.stringContaining('sharedPathRoot "../outside-src" 不在 srcRoot 内'))
  })

  it('supports string forceDuplicatePatterns when pseudo-main importer graph is incomplete', () => {
    const resolveName = createChunkNameResolver({
      sharedStrategy: 'duplicate',
      forceDuplicatePatterns: ['action/**'],
    })

    const result = resolveName('/project/src/utils.ts', {
      getModuleInfo: (id: string) => {
        const graph: Record<string, string[]> = {
          '/project/src/utils.ts': [
            '/project/src/packageA/pages/foo.ts',
            '/project/src/packageB/pages/bar.ts',
            '/project/src/action/test2.ts',
          ],
          '/project/src/packageA/pages/foo.ts': [],
          '/project/src/packageB/pages/bar.ts': [],
        }
        return {
          importers: graph[id] ?? [],
        }
      },
    })

    expect(result).toBe('weapp_shared_virtual/packageA+packageB/common')
  })

  it('supports regexp forceDuplicatePatterns against absolute ids', () => {
    const resolveName = createChunkNameResolver({
      sharedStrategy: 'duplicate',
      forceDuplicatePatterns: [/\/project\/src\/action\/.+\.ts$/],
    })

    const result = resolveName('/project/src/utils.ts', {
      getModuleInfo: (id: string) => {
        const graph: Record<string, string[]> = {
          '/project/src/utils.ts': [
            '/project/src/packageA/pages/foo.ts',
            '/project/src/packageB/pages/bar.ts',
            '/project/src/action/test2.ts',
          ],
          '/project/src/packageA/pages/foo.ts': [],
          '/project/src/packageB/pages/bar.ts': [],
        }
        return {
          importers: graph[id] ?? [],
        }
      },
    })

    expect(result).toBe('weapp_shared_virtual/packageA+packageB/common')
  })

  it('prefers sharedOverrides over the default sharedMode', () => {
    const resolveName = createChunkNameResolver({
      sharedMode: 'common',
      sharedOverrides: [
        { test: 'shared/path-only.ts', mode: 'path' },
        { test: /shared\/inline-only\.ts$/, mode: 'inline' },
      ],
    })

    const pathResult = resolveName('/project/src/shared/path-only.ts', {
      getModuleInfo: () => ({
        importers: [
          '/project/src/pages/index/index.ts',
          '/project/src/packageA/pages/foo.ts',
        ],
      }),
    })
    const inlineResult = resolveName('/project/src/shared/inline-only.ts', {
      getModuleInfo: () => ({
        importers: [
          '/project/src/pages/index/index.ts',
          '/project/src/packageB/pages/bar.ts',
        ],
      }),
    })

    expect(pathResult).toBe('shared/path-only')
    expect(inlineResult).toBeUndefined()
  })

  it('uses package-relative ids for node_modules path chunks', () => {
    const resolveName = createChunkNameResolver({
      sharedMode: 'path',
      sharedPathRoot: 'src/shared',
    })

    const result = resolveName('/project/node_modules/fake-pkg/index.js', {
      getModuleInfo: () => ({
        importers: [
          '/project/src/pages/index/index.ts',
          '/project/src/packageA/pages/foo.ts',
        ],
      }),
    })

    expect(result).toBe('fake-pkg/index')
  })

  it('falls back to the default sharedMode when overrides do not match', () => {
    const resolveName = createChunkNameResolver({
      sharedMode: 'common',
      sharedOverrides: [
        { test: 'shared/path-only.ts', mode: 'path' },
      ],
    })

    const result = resolveName('/project/src/shared/other.ts', {
      getModuleInfo: () => ({
        importers: [
          '/project/src/pages/index/index.ts',
          '/project/src/packageA/pages/foo.ts',
        ],
      }),
    })

    expect(result).toBe('common')
  })

  it('creates shared build config from scan service subpackage roots', () => {
    const config = createSharedBuildConfig(
      createConfigService({
        sharedMode: 'path',
      }),
      {
        subPackageMap: new Map([
          ['packageA', {}],
          ['packageB', {}],
        ]),
      } as any,
    )

    const resolveName = config.build!.rolldownOptions!.output!.codeSplitting.groups[0].name
    const result = resolveName('/project/src/shared/deep/feature.ts', {
      getModuleInfo: () => ({
        importers: [
          '/project/src/pages/index/index.ts',
          '/project/src/packageA/pages/foo.ts',
        ],
      }),
    })

    expect(result).toBe('shared/deep/feature')
  })
})
