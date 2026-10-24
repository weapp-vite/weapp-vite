import { mkdtemp, rm } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createModuleGraphService } from '../../../moduleGraph/service'
import { normalizeSourceId } from '../../../moduleGraph/traversal'
import { replaceSharedStyleDependencies } from './sourceDependencies'

describe('shared style asset dependencies', () => {
  let root: string
  beforeEach(async () => {
    root = await mkdtemp(path.join(os.tmpdir(), 'weapp-shared-style-owner-'))
  })
  afterEach(async () => {
    await rm(root, { recursive: true, force: true })
  })

  it('retains standalone assets and their preprocessing dependencies without a script importer', () => {
    const graph = createModuleGraphService()
    const source = path.join(root, 'shared.scss')
    const dependency = path.join(root, '_tokens.scss')
    replaceSharedStyleDependencies(graph, [{ source, dependencies: [dependency] }])

    for (const file of [source, dependency]) {
      expect(graph.hasModule(file)).toBe(true)
      expect(graph.collectAffectedEntries(file)).toEqual(new Set([normalizeSourceId(source)]))
    }
    expect(graph.hasModule(path.join(root, 'unused.scss'))).toBe(false)
  })

  it('replaces each generation and removes owners when their configuration disappears', () => {
    const graph = createModuleGraphService()
    const source = path.join(root, 'shared.scss')
    const removed = path.join(root, 'removed.scss')
    const oldDependency = path.join(root, '_old.scss')
    const nextDependency = path.join(root, '_next.scss')
    const page = path.join(root, 'page.js')
    graph.replaceEntryDependencies(page, 'style', [nextDependency])
    replaceSharedStyleDependencies(graph, [
      { source, dependencies: [oldDependency] },
      { source: removed, dependencies: [oldDependency] },
    ])
    replaceSharedStyleDependencies(graph, [{ source, dependencies: [nextDependency] }])

    expect(graph.hasModule(removed)).toBe(false)
    expect(graph.hasModule(oldDependency)).toBe(false)
    expect(graph.collectAffectedEntries(nextDependency)).toEqual(new Set([page, source].map(normalizeSourceId)))

    replaceSharedStyleDependencies(graph, [])
    expect(graph.hasModule(source)).toBe(false)
    expect(graph.collectAffectedEntries(nextDependency)).toEqual(new Set([normalizeSourceId(page)]))
  })

  it('merges multiple outputs for the same source and isolates different compiler graphs', () => {
    const graph = createModuleGraphService()
    const otherGraph = createModuleGraphService()
    const source = path.join(root, 'shared.scss')
    const dependencies = ['_first.scss', '_second.scss'].map(name => path.join(root, name))
    replaceSharedStyleDependencies(graph, dependencies.map(dependency => ({ source, dependencies: [dependency] })))
    replaceSharedStyleDependencies(otherGraph, [{ source, dependencies: [] }])
    expect(dependencies.every(file => graph.hasModule(file))).toBe(true)

    replaceSharedStyleDependencies(graph, [])
    expect(graph.hasModule(source)).toBe(false)
    expect(otherGraph.hasModule(source)).toBe(true)
  })
})
