import { describe, expect, it } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from '../moduleGraph/protocol'
import { assertModuleScopedToRoot, summarizeImportPrefixes } from './chunkStrategy/collector'

const ROOT = '/project/src'

type ImportGraph = Record<string, string[] | undefined | null>

function createCtx(graph: ImportGraph) {
  return {
    getModuleInfo: (id: string) => {
      if (id in graph) {
        return {
          importers: graph[id] ?? [],
        }
      }
      return {
        importers: [],
      }
    },
  }
}

function relativeAbsoluteSrcRoot(id: string) {
  return id.replace(`${ROOT}/`, '')
}

describe('chunkStrategy collector', () => {
  it('ignores pseudo-main importers when forceDuplicateTester matches them', () => {
    const sharedImporters = [
      `${ROOT}/packageA/pages/foo.ts`,
      `${ROOT}/packageB/pages/bar.ts`,
      `${ROOT}/action/test2.ts`,
    ]
    const { summary, ignoredMainImporters } = summarizeImportPrefixes({
      ctx: createCtx({
        [`${ROOT}/packageA/pages/foo.ts`]: [],
        [`${ROOT}/packageB/pages/bar.ts`]: [],
        [`${ROOT}/action/test2.ts`]: [],
      }),
      importers: sharedImporters,
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      forceDuplicateTester: relativeId => relativeId.startsWith('action/'),
    })

    expect(summary).toEqual({
      packageA: 1,
      packageB: 1,
    })
    expect(ignoredMainImporters).toEqual(['action/test2.ts'])
  })

  it('keeps real main importers when forceDuplicateTester does not match', () => {
    const sharedImporters = [
      `${ROOT}/packageA/pages/foo.ts`,
      `${ROOT}/packageB/pages/bar.ts`,
      `${ROOT}/pages/index/index.ts`,
    ]
    const { summary, ignoredMainImporters } = summarizeImportPrefixes({
      ctx: createCtx({
        [`${ROOT}/packageA/pages/foo.ts`]: [],
        [`${ROOT}/packageB/pages/bar.ts`]: [],
        [`${ROOT}/pages/index/index.ts`]: [],
      }),
      importers: sharedImporters,
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
      forceDuplicateTester: relativeId => relativeId.startsWith('action/'),
    })

    expect(summary).toEqual({
      '': 1,
      'packageA': 1,
      'packageB': 1,
    })
    expect(ignoredMainImporters).toEqual([])
  })

  it('derives subpackage prefixes transitively through root relays', () => {
    const { summary, ignoredMainImporters } = summarizeImportPrefixes({
      ctx: createCtx({
        [`${ROOT}/action/relay.ts`]: [
          `${ROOT}/packageA/pages/foo.ts`,
          `${ROOT}/packageB/pages/bar.ts`,
        ],
        [`${ROOT}/packageA/pages/foo.ts`]: [],
        [`${ROOT}/packageB/pages/bar.ts`]: [],
      }),
      importers: [`${ROOT}/action/relay.ts`],
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA', 'packageB'],
    })

    expect(summary).toEqual({
      packageA: 1,
      packageB: 1,
    })
    expect(ignoredMainImporters).toEqual(['action/relay.ts'])
  })

  it('projects logical entry importers back to their physical subpackage source', () => {
    const pageId = `${ROOT}/packageA/pages/foo.ts`
    const logicalPageId = createLogicalEntryId(pageId, 'page')
    const { summary } = summarizeImportPrefixes({
      ctx: createCtx({ [logicalPageId]: [] }),
      importers: [logicalPageId],
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA'],
    })

    expect(summary).toEqual({ packageA: 1 })
    expect(() => assertModuleScopedToRoot({
      moduleInfo: { importers: [logicalPageId] },
      moduleRoot: 'packageA',
      moduleId: pageId,
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA'],
    })).not.toThrow()
  })

  it('keeps sidecar source and output ownership separate', () => {
    const pageId = `${ROOT}/packageA/pages/foo.ts`
    const templateId = `${ROOT}/packageA/pages/foo.wxml`
    const sidecarId = createSidecarModuleId(pageId, templateId, 'template')
    const sidecarSourceId = createSidecarSourceSpecifier(pageId, templateId, 'template')
    const { summary } = summarizeImportPrefixes({
      ctx: createCtx({
        [sidecarId]: [],
        [sidecarSourceId]: [sidecarId],
      }),
      importers: [sidecarSourceId],
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA'],
    })

    expect(summary).toEqual({ packageA: 1 })
    expect(() => assertModuleScopedToRoot({
      moduleInfo: { importers: [sidecarId] },
      moduleRoot: 'packageA',
      moduleId: templateId,
      relativeAbsoluteSrcRoot,
      subPackageRoots: ['packageA'],
    })).not.toThrow()
  })
})
