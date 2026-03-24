import type { ConfigService } from './config/types'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { logger } from '../context/shared'
import { __clearSharedChunkDiagnosticsForTest } from './chunkStrategy'
import { createSharedBuildOutput } from './sharedBuildConfig'

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

  it('falls back to normalized relative ids for non-src path chunks', () => {
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

    expect(result).toBe('node_modules/fake-pkg/index')
  })
})
