import type { BuildGraphContext, DevModuleNode, DevServerGraphHost } from './types'
import { mkdtempSync, realpathSync, rmSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from './protocol'
import { collectBuildStartIds, collectDevStartNodes } from './traversal'

const directories: string[] = []
afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('resolves a physical file once across its logical, sidecar and queried graph nodes per traversal', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'graph-paths-'))
  directories.push(directory)
  const file = path.join(realpathSync.native(directory), 'page.ts').replaceAll('\\', '/')
  writeFileSync(file, 'Page({})')
  const ids = [file, `${file}?version=1`, createLogicalEntryId(file, 'page'), createSidecarModuleId(file, file, 'script'), createSidecarSourceSpecifier(file, file, 'script')]
  const context = { getModuleIds: () => ids } as BuildGraphContext
  const native = vi.spyOn(realpathSync, 'native')
  expect(collectBuildStartIds(context, file)).toEqual(new Set(ids))
  expect(native).toHaveBeenCalledTimes(1)
  expect(collectBuildStartIds(context, file)).toEqual(new Set(ids))
  expect(native).toHaveBeenCalledTimes(2)
})

it('keeps direct and protocol dev nodes while observing graph changes on the next traversal', () => {
  const directory = mkdtempSync(path.join(tmpdir(), 'dev-graph-paths-'))
  directories.push(directory)
  const file = path.join(realpathSync.native(directory), 'page.ts').replaceAll('\\', '/')
  writeFileSync(file, 'Page({})')
  const direct: DevModuleNode = { id: file, file }
  const logical: DevModuleNode = { id: createLogicalEntryId(file, 'page') }
  const sidecar: DevModuleNode = { id: createSidecarSourceSpecifier(file, file, 'script') }
  const nodes = new Map([[file, direct], [logical.id!, logical], [sidecar.id!, sidecar]])
  const host: DevServerGraphHost = {
    moduleGraph: {
      getModuleById: id => nodes.get(id),
      getModulesByFile: () => new Set([direct]),
      idToModuleMap: nodes,
      invalidateModule: () => {},
    },
  }
  const native = vi.spyOn(realpathSync, 'native')
  expect(collectDevStartNodes(host, file)).toEqual(new Set([direct, logical, sidecar]))
  expect(native).toHaveBeenCalledTimes(1)
  nodes.delete(logical.id!)
  expect(collectDevStartNodes(host, file)).toEqual(new Set([direct, sidecar]))
  expect(native).toHaveBeenCalledTimes(2)
})
