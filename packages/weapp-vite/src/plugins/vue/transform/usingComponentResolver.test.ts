import { describe, expect, it, vi } from 'vitest'
import { resolveUsingComponentReference } from './usingComponentResolver'

const resolveEntryPathMock = vi.hoisted(() => vi.fn(async (value: string) => value))
const resolveReExportedNameMock = vi.hoisted(() => vi.fn(async () => undefined))
const pathExistsCachedMock = vi.hoisted(() => vi.fn(async () => true))
const readFileCachedMock = vi.hoisted(() => vi.fn(async () => 'export {}'))
const usingComponentFromResolvedFileMock = vi.hoisted(() => vi.fn((value: string | undefined) => value ? `/using${value}` : undefined))

vi.mock('../../../utils/entryResolve', () => ({
  createCachedEntryResolveOptions: vi.fn((_configService: any, options?: any) => ({
    kind: options?.kind,
    exists: vi.fn(),
    stat: vi.fn(),
  })),
  resolveEntryPath: resolveEntryPathMock,
}))

vi.mock('../../../utils/reExport', () => ({
  resolveReExportedName: resolveReExportedNameMock,
}))

vi.mock('../../../utils/usingComponentFrom', () => ({
  usingComponentFromResolvedFile: usingComponentFromResolvedFileMock,
}))

vi.mock('../../utils/cache', () => ({
  pathExists: pathExistsCachedMock,
  readFile: readFileCachedMock,
}))

describe('resolveUsingComponentReference', () => {
  it('falls back to importer-relative paths when resolve misses', async () => {
    const resolved = await resolveUsingComponentReference(
      {
        resolve: vi.fn(async () => null),
      },
      {
        isDev: false,
        weappViteConfig: {},
      } as any,
      new Map(),
      './foo/button',
      '/project/src/pages/home/index.vue',
      {
        kind: 'default',
        fallbackRelativeImporterDir: true,
      },
    )

    expect(resolved.resolvedId).toBe('/project/src/pages/home/foo/button')
    expect(resolved.from).toBe('/using/project/src/pages/home/foo/button')
  })

  it('resolves named re-exported components through the shared pipeline', async () => {
    resolveEntryPathMock.mockResolvedValueOnce('/project/src/components/index.ts')
    resolveReExportedNameMock.mockResolvedValueOnce('/project/src/components/button/index.vue')

    const resolved = await resolveUsingComponentReference(
      {
        resolve: vi.fn(async () => ({ id: '/project/src/components' })),
      },
      {
        isDev: true,
        weappViteConfig: {
          ast: {
            engine: 'oxc',
          },
        },
      } as any,
      new Map(),
      './components',
      '/project/src/pages/home/index.vue',
      {
        kind: 'named',
        importedName: 'Button',
      },
    )

    expect(resolveEntryPathMock).toHaveBeenCalledWith('/project/src/components', expect.any(Object))
    expect(resolveReExportedNameMock).toHaveBeenCalledWith('/project/src/components/index.ts', 'Button', expect.objectContaining({
      astEngine: 'oxc',
    }))
    expect(resolved.resolvedId).toBe('/project/src/components/button/index.vue')
    expect(resolved.from).toBe('/using/project/src/components/button/index.vue')
  })
})
