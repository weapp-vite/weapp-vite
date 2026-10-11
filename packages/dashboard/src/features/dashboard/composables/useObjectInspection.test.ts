import type { DashboardInvestigationTarget } from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult } from '../types'
import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { useObjectInspection } from './useObjectInspection'

const report: AnalyzeSubpackagesResult = {
  packages: [{ id: 'main', label: '主包', type: 'main', files: Array.from({ length: 25 }, (_, index) => ({
    file: `pages/${index}.js`,
    type: 'chunk',
    from: 'main',
    size: index,
    modules: [{ id: `module-${index}`, source: `src/${index}.ts`, sourceType: 'src', bytes: index }],
  })) }],
  modules: [],
  subPackages: [],
}

describe('independent workbench browsing state', () => {
  it('keeps package, artifact and module collections stable across every target kind', () => {
    const target = shallowRef<DashboardInvestigationTarget | null>(null)
    const state = useObjectInspection({ result: shallowRef(report), target })
    state.packageFilter.value = 'main'
    state.artifactQuery.value = 'pages/'
    state.moduleQuery.value = 'src/'
    const artifacts = state.artifacts.value
    const modules = state.modules.value
    for (const next of [state.index.value.packages[0]!, state.index.value.artifacts[24]!, state.index.value.modules[24]!]) {
      target.value = next.target
      expect(state.selected.value?.key).toBe(next.key)
      expect(state.artifacts.value).toBe(artifacts)
      expect(state.modules.value).toBe(modules)
      expect(state.artifactQuery.value).toBe('pages/')
      expect(state.moduleQuery.value).toBe('src/')
      expect(state.packageFilter.value).toBe('main')
    }
    expect(state.artifacts.value).toHaveLength(25)
  })

  it('keeps selected context available outside a search and derives report replacement fallback', () => {
    const result = shallowRef(report)
    const target = shallowRef<DashboardInvestigationTarget | null>({ kind: 'module', packageId: 'main', file: 'pages/24.js', moduleId: 'module-24' })
    const state = useObjectInspection({ result, target })
    state.artifactQuery.value = 'no-match'
    expect(state.artifacts.value).toEqual([])
    expect(state.selectedArtifact.value?.label).toBe('pages/24.js')
    result.value = { ...report, packages: [{ ...report.packages[0]!, files: [report.packages[0]!.files[0]!] }] }
    expect(state.targetMissing.value).toBe(true)
    expect(state.selected.value?.label).toBe('pages/0.js')
    expect(target.value).toMatchObject({ moduleId: 'module-24' })
    expect(state.artifactQuery.value).toBe('no-match')
  })
})
