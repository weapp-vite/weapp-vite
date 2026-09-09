import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from './protocol'
import { createModuleGraphService } from './service'

describe('bundled development graph ownership', () => {
  it('keeps build-end synchronization on the DevEngine graph without running unbundled transforms', async () => {
    const pageId = '/project/src/pages/index.tsx'
    const dependencyId = '/project/src/shared.tsx'
    const logicalId = createLogicalEntryId(pageId, 'page')
    const modules = new Map([
      [logicalId, { importers: [] as string[] }],
      [pageId, { importers: [logicalId] }],
      [dependencyId, { importers: [pageId] }],
    ])
    const buildContext = {
      getModuleIds: () => modules.keys(),
      getModuleInfo: (id: string) => modules.get(id),
    }
    const transformRequest = vi.fn(async () => {
      throw new Error('Unbundled transform cannot emit component chunks after buildEnd')
    })
    const invalidateModule = vi.fn()
    const service = createModuleGraphService()
    service.bindBuildContext({}, buildContext)
    service.bindDevServer({
      environments: { client: { bundledDev: {} } },
      moduleGraph: {
        getModuleById: () => undefined,
        getModulesByFile: () => undefined,
        invalidateModule,
      },
      transformRequest,
    })

    await service.syncDevGraph(buildContext)
    expect(transformRequest).not.toHaveBeenCalled()
    expect(service.hasModule(dependencyId)).toBe(true)
    expect(service.collectAffectedEntries(dependencyId)).toEqual(new Set([pageId]))
    expect(service.invalidate(dependencyId)).toEqual(new Set([pageId]))
    expect(invalidateModule).not.toHaveBeenCalled()
  })
})
