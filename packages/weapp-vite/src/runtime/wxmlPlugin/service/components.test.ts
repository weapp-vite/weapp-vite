import type { MutableCompilerContext } from '../../../context'
import { describe, expect, it } from 'vitest'
import { createRuntimeState } from '../../runtimeState'
import { createWxmlComponentService } from './components'
import { createWxmlDependencyService } from './deps'
import { createWxmlServiceState } from './shared'

function createServices() {
  const ctx = { runtimeState: createRuntimeState() } as MutableCompilerContext
  const state = createWxmlServiceState(ctx)
  const components = createWxmlComponentService(state)
  const deps = createWxmlDependencyService(state, async () => undefined)
  return { components, deps }
}

describe('WXML component aggregate invalidation', () => {
  it('refreshes auto imports when Vue tags change without dependency changes', async () => {
    const { components, deps } = createServices()
    const page = 'pages/index/index.vue'
    const autoCard = { 'auto-card': [{ start: 0, end: 0 }] }
    const resolverCard = { 'resolver-card': [{ start: 0, end: 0 }] }
    await deps.setDeps(page, [])
    components.setWxmlComponentsMap(page, { ...autoCard, ...resolverCard })

    expect(components.getAggregatedAutoImportComponents(page)).toEqual({ ...autoCard, ...resolverCard })
    expect(components.getAggregatedComponents(page)).toEqual({ ...autoCard, ...resolverCard })

    components.setWxmlComponentsMap(page, resolverCard)
    await deps.setDeps(page, [])

    expect(components.getAggregatedAutoImportComponents(page)).toEqual(resolverCard)
    expect(components.getAggregatedComponents(page)).toEqual(resolverCard)

    components.setWxmlComponentsMap(page, {})
    expect(components.getAggregatedAutoImportComponents(page)).toEqual({})
    expect(components.getAggregatedComponents(page)).toEqual({})

    components.setWxmlComponentsMap(page, autoCard)
    expect(components.getAggregatedAutoImportComponents(page)).toEqual(autoCard)
    expect(components.getAggregatedComponents(page)).toEqual(autoCard)
  })

  it('refreshes cached auto imports through every importer when a nested template changes', async () => {
    const { components, deps } = createServices()
    const page = 'pages/index/index.wxml'
    const branch = 'templates/branch.wxml'
    const leaf = 'templates/leaf.wxml'
    const pageComponents = { 'page-shell': [{ start: 0, end: 0 }] }
    const branchComponents = { 'branch-shell': [{ start: 0, end: 0 }] }
    const initialLeafComponents = { 'auto-card': [{ start: 0, end: 0 }] }
    const nextLeafComponents = { 'resolver-card': [{ start: 0, end: 0 }] }
    await deps.setDeps(page, [branch])
    await deps.setDeps(branch, [leaf])
    components.setWxmlComponentsMap(page, pageComponents)
    components.setWxmlComponentsMap(branch, branchComponents)
    components.setWxmlComponentsMap(leaf, initialLeafComponents)

    const initialPageAggregate = components.getAggregatedAutoImportComponents(page)
    const initialBranchAggregate = components.getAggregatedAutoImportComponents(branch)
    expect(initialPageAggregate).toEqual({ ...pageComponents, ...branchComponents, ...initialLeafComponents })
    expect(initialBranchAggregate).toEqual({ ...branchComponents, ...initialLeafComponents })
    expect(components.getAggregatedComponents(page)).toEqual(initialPageAggregate)

    components.setWxmlComponentsMap(leaf, nextLeafComponents)

    expect(components.getAggregatedAutoImportComponents(page)).toEqual({ ...pageComponents, ...branchComponents, ...nextLeafComponents })
    expect(components.getAggregatedAutoImportComponents(page)).not.toBe(initialPageAggregate)
    expect(components.getAggregatedAutoImportComponents(branch)).toEqual({ ...branchComponents, ...nextLeafComponents })
    expect(components.getAggregatedAutoImportComponents(branch)).not.toBe(initialBranchAggregate)
    expect(components.getAggregatedComponents(page)).toEqual({ ...pageComponents, ...branchComponents, ...nextLeafComponents })
  })
})
