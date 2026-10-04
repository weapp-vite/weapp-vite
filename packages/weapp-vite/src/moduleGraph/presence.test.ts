import type { DevModuleNode, DevServerGraphHost } from './types'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, writeFileSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from './protocol'
import { createModuleGraphService } from './service'
import { collectBuildStartIds, collectDevStartNodes, normalizeSourceId } from './traversal'

let root: string
let source: string
let owner: string

beforeEach(() => {
  root = realpathSync(mkdtempSync(path.join(os.tmpdir(), 'module-presence-')))
  source = path.join(root, 'source.ts')
  owner = path.join(root, 'page.ts')
  writeFileSync(source, 'export const value = 1')
  writeFileSync(owner, 'export {}')
})

afterEach(() => {
  vi.restoreAllMocks()
  rmSync(root, { recursive: true, force: true })
})

function createHost(ids: string[] = [], indexed?: DevModuleNode): DevServerGraphHost {
  const nodes = new Map(ids.map(id => [id, { id }]))
  return {
    moduleGraph: {
      getModuleById: id => nodes.get(id),
      getModulesByFile: file => indexed && file === normalizeSourceId(source) ? new Set([indexed]) : undefined,
      idToModuleMap: nodes,
      invalidateModule: vi.fn(),
    },
  }
}

describe('module presence queries', () => {
  it('uses the live dev file index without enumerating unrelated module ids', () => {
    const direct = { id: source, file: source }
    const host = createHost([source, owner], direct)
    const iterate = vi.spyOn(host.moduleGraph.idToModuleMap!, Symbol.iterator)
    const service = createModuleGraphService()
    service.bindDevServer(host)

    expect(service.hasModule(source)).toBe(true)
    expect(iterate).not.toHaveBeenCalled()
    expect(collectDevStartNodes(host, normalizeSourceId(source))).toEqual(new Set([direct, host.moduleGraph.idToModuleMap!.get(source)]))
  })

  it('stops the fallback dev scan after the first matching id and reads removals immediately', () => {
    const logical = createLogicalEntryId(source, 'page')
    const host = createHost([logical, owner])
    const map = host.moduleGraph.idToModuleMap!
    let visits = 0
    vi.spyOn(map, Symbol.iterator).mockImplementation(function* () {
      for (const item of map.entries()) {
        visits += 1
        yield item
      }
    })
    const service = createModuleGraphService()
    service.bindDevServer(host)

    expect(service.hasModule(source)).toBe(true)
    expect(visits).toBe(1)
    map.delete(logical)
    expect(service.hasModule(source)).toBe(false)
    map.set(logical, { id: logical })
    expect(service.hasModule(source)).toBe(true)
  })

  it('closes a build iterator at the first match without weakening full collection', () => {
    const afterMatch = vi.fn()
    const closed = vi.fn()
    const logical = createLogicalEntryId(source, 'page')
    const context = {
      * getModuleIds() {
        try {
          yield source
          afterMatch()
          yield logical
        }
        finally {
          closed()
        }
      },
    }
    const service = createModuleGraphService()
    service.bindBuildContext({}, context)

    expect(service.hasModule(source)).toBe(true)
    expect(afterMatch).not.toHaveBeenCalled()
    expect(closed).toHaveBeenCalledTimes(1)
    expect(collectBuildStartIds(context, normalizeSourceId(source))).toEqual(new Set([source, logical]))
  })

  it.each(['source', 'query', 'logical', 'sidecar', 'sidecar-source'] as const)('preserves %s matching in both graph providers', (kind) => {
    const id = {
      source,
      'query': `${source}?variant=one`,
      'logical': createLogicalEntryId(source, 'page'),
      'sidecar': createSidecarModuleId(owner, source, 'script'),
      'sidecar-source': createSidecarSourceSpecifier(owner, source, 'script'),
    }[kind]
    const service = createModuleGraphService()
    const unbind = service.bindDevServer(createHost([owner, id]))
    expect(service.hasModule(source)).toBe(true)
    unbind()
    const ids = new Set([owner, id])
    const release = service.bindBuildContext({}, { getModuleIds: () => ids })
    expect(service.hasModule(source)).toBe(true)
    ids.delete(id)
    expect(service.hasModule(source)).toBe(false)
    release()
  })

  it('keeps registered dependencies and later build contexts visible in bundled dev', () => {
    const service = createModuleGraphService()
    const host = createHost([source], { id: source, file: source })
    host.environments = { client: { bundledDev: true } }
    service.bindDevServer(host)
    service.bindBuildContext({}, { getModuleIds: () => [owner] })
    expect(service.hasModule(source)).toBe(false)
    const release = service.bindBuildContext({}, { getModuleIds: () => [source] })
    expect(service.hasModule(source)).toBe(true)
    release()
    service.replaceEntryDependencies(owner, 'script', [source])
    expect(service.hasModule(source)).toBe(true)
    service.removeEntryDependencies(owner)
    expect(service.hasModule(source)).toBe(false)
  })

  it('resolves symlink aliases without persisting a result after graph removal', () => {
    const physicalRoot = path.join(root, 'physical')
    const aliasRoot = path.join(root, 'linked')
    mkdirSync(physicalRoot)
    const physicalSource = path.join(physicalRoot, 'source.ts')
    writeFileSync(physicalSource, 'export const value = 1')
    symlinkSync(physicalRoot, aliasRoot, process.platform === 'win32' ? 'junction' : 'dir')
    const alias = path.join(aliasRoot, 'source.ts')
    const host = createHost([alias])
    const service = createModuleGraphService()
    service.bindDevServer(host)
    expect(service.hasModule(physicalSource)).toBe(true)
    host.moduleGraph.idToModuleMap!.clear()
    expect(service.hasModule(physicalSource)).toBe(false)
  })
})
