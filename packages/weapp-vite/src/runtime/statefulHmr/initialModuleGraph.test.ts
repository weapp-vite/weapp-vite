import type { ModuleInfo } from 'rolldown'
import { createContext, runInContext } from 'node:vm'
import { describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId } from '../../moduleGraph/protocol'
import { createStatefulHmrRolldownRuntimeSource } from './commonRuntime'
import { createStatefulHmrInitialGraph } from './initialModuleGraph'

interface GraphRuntime {
  staticImports: Map<string, { edges: string[] }>
  dynamicImports: Map<string, { edges: string[] }>
  getImporters: (id: string) => string[]
  isExecuted: (id: string) => boolean
  hasFactory: (id: string) => boolean
}

function moduleInfo(importedIds: string[] = [], dynamicallyImportedIds: string[] = [], isExternal = false): ModuleInfo {
  return { importedIds, dynamicallyImportedIds, isExternal } as ModuleInfo
}

function fixture() {
  const context = createContext({ console })
  runInContext(createStatefulHmrRolldownRuntimeSource(), context, { timeout: 5_000 })
  const runtime = runInContext('globalThis.__rolldown_runtime__', context) as GraphRuntime
  return {
    runtime,
    register(moduleIds: string[], modules: Map<string, ModuleInfo | null>, root: string) {
      const getModuleInfo = vi.fn((id: string) => modules.get(id) ?? null)
      const code = createStatefulHmrInitialGraph({ moduleIds }, { getModuleInfo }, root)
      runInContext(code, context, { timeout: 5_000 })
      return getModuleInfo
    },
  }
}

describe('initial CJS module graph', () => {
  it.each([
    { platform: 'POSIX', root: '/project', source: '/project/src/component.vue', dependency: '/project/src/shared.ts' },
    { platform: 'Windows', root: 'C:\\project', source: 'C:\\project\\src\\component.vue', dependency: 'C:\\project\\src\\shared.ts' },
  ])('matches registration IDs for $platform physical and logical modules', ({ root, source, dependency }) => {
    const { runtime, register } = fixture()
    const owner = createLogicalEntryId(source, 'component')
    const relativeRequest = 'src/tokens.ts?raw&lang.js'
    const virtualModule = '\0virtual:tokens'
    const modules = new Map([
      [owner, moduleInfo([source])],
      [source, moduleInfo([dependency, relativeRequest, virtualModule])],
      [dependency, moduleInfo()],
      [relativeRequest, moduleInfo()],
      [virtualModule, moduleInfo()],
    ])

    register([...modules.keys()], modules, root)

    expect([...runtime.staticImports.keys()]).toEqual([owner, 'src/component.vue', 'src/shared.ts', relativeRequest, virtualModule])
    expect(runtime.getImporters('src/component.vue')).toEqual([owner])
    expect(runtime.getImporters('src/shared.ts')).toEqual(['src/component.vue'])
    expect(runtime.getImporters(relativeRequest)).toEqual(['src/component.vue'])
    expect(runtime.getImporters(virtualModule)).toEqual(['src/component.vue'])
  })

  it('merges static and dynamic importer edges across separately registered chunks', () => {
    const { runtime, register } = fixture()
    const root = '/project'
    const page = `${root}/page.ts`
    const otherPage = `${root}/other-page.ts`
    const shared = `${root}/shared.ts`
    const lazy = `${root}/lazy.ts`
    const modules = new Map([
      [page, moduleInfo([shared], [lazy, shared])],
      [otherPage, moduleInfo([shared])],
      [shared, moduleInfo([lazy])],
      [lazy, moduleInfo()],
    ])

    register([page, otherPage], modules, root)
    expect([...runtime.staticImports.keys()]).toEqual(['page.ts', 'other-page.ts'])
    expect(runtime.staticImports.get('page.ts')?.edges).toEqual(['shared.ts'])
    expect(runtime.dynamicImports.get('page.ts')?.edges).toEqual(['lazy.ts', 'shared.ts'])
    expect(runtime.getImporters('shared.ts')).toEqual(['page.ts', 'other-page.ts'])

    register([shared, lazy], modules, root)
    expect(runtime.getImporters('shared.ts')).toEqual(['page.ts', 'other-page.ts'])
    expect(runtime.getImporters('lazy.ts').sort()).toEqual(['page.ts', 'shared.ts'])
    expect(runtime.staticImports.get('shared.ts')?.edges).toEqual(['lazy.ts'])
  })

  it('omits null synthetic helpers without shifting remaining module rows', () => {
    const { runtime, register } = fixture()
    const helper = '\0rolldown/runtime'
    const source = '/project/source.ts'
    const importer = '/project/importer.ts'
    const modules = new Map([
      [helper, null],
      [source, moduleInfo()],
      [importer, moduleInfo([source])],
    ])

    const getModuleInfo = register([helper, source, importer], modules, '/project')

    expect(getModuleInfo).toHaveBeenCalledWith(helper)
    expect([...runtime.staticImports.keys()]).toEqual(['source.ts', 'importer.ts'])
    expect(runtime.getImporters('source.ts')).toEqual(['importer.ts'])
    expect(runtime.staticImports.has(helper)).toBe(false)
  })

  it('keeps external references as foreign graph targets without inventing executable modules', () => {
    const { runtime, register } = fixture()
    const source = '/project/source.ts'
    const external = 'external-runtime'
    const modules = new Map([
      [source, moduleInfo([external], [external])],
      [external, moduleInfo([], [], true)],
    ])

    const getModuleInfo = register([source], modules, '/project')

    expect(getModuleInfo).not.toHaveBeenCalledWith(external)
    expect([...runtime.staticImports.keys()]).toEqual(['source.ts'])
    expect(runtime.getImporters(external)).toEqual(['source.ts'])
    expect(runtime.staticImports.has(external)).toBe(false)
    expect(runtime.dynamicImports.has(external)).toBe(false)
    expect(runtime.isExecuted(external)).toBe(false)
    expect(runtime.hasFactory(external)).toBe(false)
  })

  it('registers a helper-only chunk without erasing existing graph rows', () => {
    const { runtime, register } = fixture()
    const source = '/project/source.ts'
    register([source], new Map([[source, moduleInfo()]]), '/project')

    register(['\0rolldown/runtime'], new Map(), '/project')

    expect([...runtime.staticImports.keys()]).toEqual(['source.ts'])
    expect(runtime.getImporters('source.ts')).toEqual([])
  })
})
