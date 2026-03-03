import { describe, expect, it } from 'vitest'
import { parseJsLike } from '../../../../utils/babel'
import { createModuleAnalysis } from '../moduleAnalysis'
import { resolveExternalFunction } from './resolve'

describe('reachability resolve', () => {
  it('returns null for wevu runtime module and unresolved modules', async () => {
    const resolver = {
      resolveId: async () => undefined as string | undefined,
      loadCode: async () => undefined as string | undefined,
    }

    await expect(
      resolveExternalFunction(resolver, '/project/src/page.ts', 'wevu', 'onPageScroll', new Map()),
    ).resolves.toBeNull()

    await expect(
      resolveExternalFunction(resolver, '/project/src/page.ts', './missing', 'run', new Map()),
    ).resolves.toBeNull()
  })

  it('returns null when code missing or export not found', async () => {
    const resolverMissingCode = {
      resolveId: async () => '/project/src/ext.ts',
      loadCode: async () => undefined as string | undefined,
    }
    await expect(
      resolveExternalFunction(resolverMissingCode, '/project/src/page.ts', './ext', 'run', new Map()),
    ).resolves.toBeNull()

    const resolverMissingExport = {
      resolveId: async () => '/project/src/ext.ts',
      loadCode: async () => `export const value = 1`,
    }
    await expect(
      resolveExternalFunction(resolverMissingExport, '/project/src/page.ts', './ext', 'run', new Map()),
    ).resolves.toBeNull()
  })

  it('resolves inline exported function and reexport target', async () => {
    const moduleCodeById: Record<string, string> = {
      '/project/src/ext.ts': `export function run() {}`,
      '/project/src/reexp.ts': `export { sourceRun as run } from './source'`,
    }
    const resolver = {
      resolveId: async (source: string) => {
        if (source === './ext') {
          return '/project/src/ext.ts'
        }
        if (source === './reexp') {
          return '/project/src/reexp.ts'
        }
      },
      loadCode: async (id: string) => moduleCodeById[id],
    }

    const inlineResult = await resolveExternalFunction(
      resolver,
      '/project/src/page.ts',
      './ext',
      'run',
      new Map(),
    )
    expect(inlineResult).toBeTruthy()
    expect(inlineResult && 'fn' in inlineResult).toBe(true)
    expect(inlineResult && 'module' in inlineResult && inlineResult.module.id).toBe('/project/src/ext.ts')

    const reexportResult = await resolveExternalFunction(
      resolver,
      '/project/src/page.ts',
      './reexp',
      'run',
      new Map(),
    )
    expect(reexportResult).toEqual({
      moduleId: '/project/src/reexp.ts',
      reexport: {
        source: './source',
        importedName: 'sourceRun',
      },
    })
  })

  it('uses moduleCache when analysis already exists', async () => {
    const cachedAnalysis = createModuleAnalysis(
      '/project/src/cached.ts',
      parseJsLike(`export default function cached() {}`),
    )
    const moduleCache = new Map<string, ReturnType<typeof createModuleAnalysis>>([
      ['/project/src/cached.ts', cachedAnalysis],
    ])

    const resolver = {
      resolveId: async () => '/project/src/cached.ts',
      loadCode: async () => `export default function replaced() {}`,
    }

    const result = await resolveExternalFunction(
      resolver,
      '/project/src/page.ts',
      './cached',
      'default',
      moduleCache,
    )

    expect(result).toBeTruthy()
    expect(result && 'moduleId' in result && result.moduleId).toBe('/project/src/cached.ts')
    expect(moduleCache.get('/project/src/cached.ts')).toBe(cachedAnalysis)
  })
})
