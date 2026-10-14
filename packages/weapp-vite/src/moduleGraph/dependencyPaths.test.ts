import { mkdirSync, mkdtempSync, realpathSync, rmSync, symlinkSync, unlinkSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { afterEach, expect, it, vi } from 'vitest'
import { createModuleGraphService } from './service'

const directories: string[] = []
const operations = ['entry', 'transform'] as const

function fixture() {
  const directory = mkdtempSync(path.join(tmpdir(), 'graph-dependency-paths-'))
  directories.push(directory)
  const root = realpathSync.native(directory).replaceAll('\\', '/')
  const owner = `${root}/page.vue`
  writeFileSync(owner, '<template><view /></template>')
  return { root, owner }
}

function dependencies(operation: typeof operations[number]) {
  const service = createModuleGraphService()
  return {
    replace: (owner: string, sources: Iterable<string>) => operation === 'entry'
      ? service.replaceEntryDependencies(owner, 'style', sources)
      : service.replaceTransformDependencies(owner, sources),
    read: (owner: string) => operation === 'entry'
      ? service.getEntryDependencies(owner).map(dependency => dependency.sourceId)
      : service.getTransformDependencies(owner),
  }
}

afterEach(() => {
  vi.restoreAllMocks()
  for (const directory of directories.splice(0)) {
    rmSync(directory, { recursive: true, force: true })
  }
})

it('does not resolve source identity when no transform dependency is registered', () => {
  const { owner } = fixture()
  const service = createModuleGraphService()
  const native = vi.spyOn(realpathSync, 'native')

  expect(service.getTransformDependencies(owner)).toEqual([])
  expect(native).not.toHaveBeenCalled()

  service.replaceTransformDependencies(owner, [owner])
  expect(service.getTransformDependencies(owner)).toEqual([owner])
  service.replaceTransformDependencies(owner, [])
  native.mockClear()
  expect(service.getTransformDependencies(owner)).toEqual([])
  expect(native).not.toHaveBeenCalled()
})

it.each(operations)('%s dependency replacement resolves duplicate source identities once per operation', (operation) => {
  const { root, owner } = fixture()
  const style = `${root}/theme.css`
  writeFileSync(style, '.message { color: green; }')
  const graph = dependencies(operation)
  const native = vi.spyOn(realpathSync, 'native')

  graph.replace(owner, [owner, `${owner}?raw`, style, `${style}?lang.css`])
  expect(native.mock.calls.map(([file]) => file)).toEqual([owner, style])
  expect(graph.read(owner)).toEqual([owner, style])

  native.mockClear()
  graph.replace(owner, [owner, style])
  expect(native.mock.calls.map(([file]) => file)).toEqual([owner, style])
  graph.replace(owner, [])
  expect(graph.read(owner)).toEqual([])
})

it.each(operations)('%s dependency replacement observes a changed junction target in the next operation', (operation) => {
  const { root, owner } = fixture()
  const first = `${root}/first`
  const second = `${root}/second`
  const alias = `${root}/alias`
  for (const directory of [first, second]) {
    mkdirSync(directory)
    writeFileSync(`${directory}/theme.css`, '')
  }
  symlinkSync(first, alias, 'junction')
  const source = `${alias}/theme.css`
  const graph = dependencies(operation)

  graph.replace(owner, [source, `${source}?lang.css`])
  expect(graph.read(owner)).toEqual([`${first}/theme.css`])
  unlinkSync(alias)
  symlinkSync(second, alias, 'junction')
  graph.replace(owner, [source, `${source}?lang.css`])
  expect(graph.read(owner)).toEqual([`${second}/theme.css`])
})

it.each(operations)('%s dependency replacement releases its path scope after an input failure', (operation) => {
  const { owner } = fixture()
  const graph = dependencies(operation)
  const sources = {
    * [Symbol.iterator]() {
      yield owner
      throw new Error('dependency collection failed')
    },
  }
  const native = vi.spyOn(realpathSync, 'native')

  expect(() => graph.replace(owner, sources)).toThrow('dependency collection failed')
  native.mockClear()
  graph.replace(owner, [owner, `${owner}?raw`])
  expect(native.mock.calls.map(([file]) => file)).toEqual([owner])
  expect(graph.read(owner)).toEqual([owner])
})
