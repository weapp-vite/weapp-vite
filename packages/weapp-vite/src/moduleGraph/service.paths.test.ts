import type { BuildGraphContext, DevModuleNode, DevServerGraphHost } from './types'
import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createLogicalEntryId, createSidecarModuleId, createSidecarSourceSpecifier } from './protocol'
import { createModuleGraphService } from './service'

const directories: string[] = []
const operations = ['collectAffectedEntries', 'invalidate'] as const

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'graph-service-paths-'))
  directories.push(directory)
  return realpathSync.native(directory).replaceAll('\\', '/')
}

function writeSource(directory: string, name = 'page.ts') {
  const file = `${directory}/${name}`
  writeFileSync(file, 'Page({})')
  return file
}

function moduleIds(file: string) {
  return [
    file,
    `${file}?version=1`,
    createLogicalEntryId(file, 'page'),
    createSidecarModuleId(file, file, 'script'),
    createSidecarSourceSpecifier(file, file, 'script'),
  ]
}

function linkedFixture() {
  const directory = fixture()
  const first = `${directory}/first`
  const second = `${directory}/second`
  const alias = `${directory}/linked`
  mkdirSync(first)
  mkdirSync(second)
  symlinkSync(first, alias, 'junction')
  const owner = writeSource(directory)
  return { alias, aliasFile: `${alias}/value.ts`, first, second, owner }
}

function bindLinkedBuildGraph(aliasFile: string, owner: string) {
  const service = createModuleGraphService()
  const logical = createLogicalEntryId(owner, 'page')
  const context: BuildGraphContext = {
    getModuleIds: () => [aliasFile],
    getModuleInfo: () => ({ importers: [logical] }),
  }
  service.bindBuildContext({}, context)
  return { service, context }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

it.each(operations)('%s shares successful path reads across build graph scopes and importer traversal', (operation) => {
  const directory = fixture()
  const file = writeSource(directory)
  const registeredOwner = writeSource(directory, 'registered.ts')
  const ids = moduleIds(file)
  const logical = ids[2]!
  const context: BuildGraphContext = {
    getModuleIds: () => ids,
    getModuleInfo: () => ({ importers: [logical] }),
  }
  const service = createModuleGraphService()
  service.bindBuildContext({}, context)
  service.bindBuildContext({}, context)
  service.replaceEntryDependencies(registeredOwner, 'script', [file])
  const native = vi.spyOn(realpathSync, 'native')

  expect(service[operation](`${file}?changed=1`)).toEqual(new Set([registeredOwner, file]))
  expect(native.mock.calls.map(([source]) => source)).toEqual([file])
  expect(service[operation](file)).toEqual(new Set([registeredOwner, file]))
  expect(native.mock.calls.map(([source]) => source)).toEqual([file, file])
})

it.each(operations)('%s shares dev graph reads while preserving every invalidated node', (operation) => {
  const file = writeSource(fixture())
  const ids = moduleIds(file)
  const logical: DevModuleNode = { id: ids[2]! }
  const nodes = new Map<string, DevModuleNode>(ids.map(id => [id, {
    id,
    importers: new Set([logical]),
  }]))
  nodes.set(logical.id!, logical)
  const direct = nodes.get(file)!
  direct.file = file
  const invalidateModule = vi.fn()
  const host: DevServerGraphHost = {
    moduleGraph: {
      getModuleById: id => nodes.get(id),
      getModulesByFile: id => id === file ? new Set([direct]) : undefined,
      idToModuleMap: nodes,
      invalidateModule,
    },
  }
  const service = createModuleGraphService()
  service.bindDevServer(host)
  const native = vi.spyOn(realpathSync, 'native')

  expect(service[operation](`${file}?changed=1`)).toEqual(new Set([file]))
  expect(native.mock.calls.map(([source]) => source)).toEqual([file])
  expect(invalidateModule.mock.calls.map(([node]) => node)).toEqual(operation === 'invalidate' ? [...nodes.values()] : [])
  expect(service[operation](file)).toEqual(new Set([file]))
  expect(native.mock.calls.map(([source]) => source)).toEqual([file, file])
})

it.each(operations)('%s observes junction replacement in the next operation', (operation) => {
  const { alias, aliasFile, first, second, owner } = linkedFixture()
  const firstFile = writeSource(first, 'value.ts')
  const secondFile = writeSource(second, 'value.ts')
  const { service } = bindLinkedBuildGraph(aliasFile, owner)
  const native = vi.spyOn(realpathSync, 'native')

  expect(service[operation](firstFile)).toEqual(new Set([owner]))
  unlinkSync(alias)
  symlinkSync(second, alias, 'junction')
  expect(service[operation](firstFile)).toEqual(new Set())
  expect(service[operation](secondFile)).toEqual(new Set([owner]))
  expect(native.mock.calls.filter(([source]) => source === aliasFile)).toHaveLength(3)
})

it.each(operations)('%s refreshes missing, created, deleted and restored files between operations', (operation) => {
  const { aliasFile, first, owner } = linkedFixture()
  const file = `${first}/value.ts`
  const { service } = bindLinkedBuildGraph(aliasFile, owner)
  const native = vi.spyOn(realpathSync, 'native')

  expect(service[operation](file)).toEqual(new Set())
  writeSource(first, 'value.ts')
  expect(service[operation](file)).toEqual(new Set([owner]))
  unlinkSync(file)
  expect(service[operation](file)).toEqual(new Set())
  writeSource(first, 'value.ts')
  expect(service[operation](file)).toEqual(new Set([owner]))
  expect(native.mock.calls.filter(([source]) => source === aliasFile)).toHaveLength(4)
})

it('releases the affected-entry scope when the build graph throws', () => {
  const { alias, aliasFile, first, second, owner } = linkedFixture()
  const firstFile = writeSource(first, 'value.ts')
  const secondFile = writeSource(second, 'value.ts')
  const { service, context } = bindLinkedBuildGraph(aliasFile, owner)
  const failure = new Error('build graph unavailable')
  vi.spyOn(context, 'getModuleInfo').mockImplementationOnce(() => {
    throw failure
  })
  const native = vi.spyOn(realpathSync, 'native')

  let thrown: unknown
  try {
    service.collectAffectedEntries(firstFile)
  }
  catch (error) {
    thrown = error
  }
  expect(thrown).toBe(failure)
  unlinkSync(alias)
  symlinkSync(second, alias, 'junction')
  expect(service.collectAffectedEntries(firstFile)).toEqual(new Set())
  expect(service.collectAffectedEntries(secondFile)).toEqual(new Set([owner]))
  expect(native.mock.calls.filter(([source]) => source === aliasFile)).toHaveLength(3)
})

it('releases the outer invalidation scope when the dev graph throws after collection', () => {
  const { alias, aliasFile, first, second, owner } = linkedFixture()
  const firstFile = writeSource(first, 'value.ts')
  const secondFile = writeSource(second, 'value.ts')
  const logical: DevModuleNode = { id: createLogicalEntryId(owner, 'page') }
  const dependency: DevModuleNode = { id: aliasFile, importers: new Set([logical]) }
  const failure = new Error('invalidation unavailable')
  const invalidateModule = vi.fn().mockImplementationOnce(() => {
    throw failure
  })
  const service = createModuleGraphService()
  service.bindDevServer({
    moduleGraph: {
      getModuleById: () => undefined,
      getModulesByFile: () => undefined,
      idToModuleMap: new Map([[aliasFile, dependency]]),
      invalidateModule,
    },
  })
  const native = vi.spyOn(realpathSync, 'native')

  let thrown: unknown
  try {
    service.invalidate(firstFile)
  }
  catch (error) {
    thrown = error
  }
  expect(thrown).toBe(failure)
  expect(invalidateModule).toHaveBeenLastCalledWith(dependency)
  unlinkSync(alias)
  symlinkSync(second, alias, 'junction')
  expect(service.invalidate(firstFile)).toEqual(new Set())
  expect(service.invalidate(secondFile)).toEqual(new Set([owner]))
  expect(native.mock.calls.filter(([source]) => source === aliasFile)).toHaveLength(3)
  expect(invalidateModule.mock.calls).toEqual([[dependency], [dependency]])
})
