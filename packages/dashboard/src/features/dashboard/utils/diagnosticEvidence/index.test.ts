import type { AnalyzeActionCenterItem, AnalyzeSubpackagesResult, ModuleInFile, PackageFileEntry, PackageReport } from '../../types'
import { describe, expect, it } from 'vitest'
import { shallowRef } from 'vue'
import { useAnalyzeActionCenter } from '../../composables/useAnalyzeActionCenter'
import { useAnalyzeCommandPalette } from '../../composables/useAnalyzeCommandPalette'
import { useAnalyzeDashboardData } from '../../composables/useAnalyzeDashboardData'
import { createBudgetWarnings } from '../analyzeDataBudgets'
import { createIncrementAttribution } from '../analyzeDataIncrements'
import { createDuplicateModules } from '../analyzeDataModules'
import { createLargestFiles } from '../analyzeDataPackages'
import { formatBytes } from '../format'
import { createTreemapModuleNodeId } from '../treemap'
import { createActionWorkQueueItem } from '../workQueue'
import { createDiagnosticEvidence } from './index'

function report(packages: PackageReport[]): AnalyzeSubpackagesResult {
  return {
    metadata: {
      generatedAt: '2026-01-01T00:00:00.000Z',
      history: { enabled: false, dir: '', limit: 0 },
      budgets: { totalBytes: 100, mainBytes: 100, subPackageBytes: 100, independentBytes: 100, runtimeBytes: 50, warningRatio: 0.85, source: 'config' },
    },
    packages,
    modules: [],
    subPackages: [],
  }
}

function pkg(id: string, files: PackageFileEntry[], type: PackageReport['type'] = 'main'): PackageReport {
  return { id, label: id, type, files }
}

function file(path: string, size?: number): PackageFileEntry {
  return { file: path, size, type: 'chunk', from: 'main' }
}

function action(kind: AnalyzeActionCenterItem['kind'], key: string): AnalyzeActionCenterItem {
  return { kind, key, title: key, targetLabel: key, meta: '', tone: 'info', tab: 'diagnostics', priority: 0 }
}

function evidence(result: AnalyzeSubpackagesResult, selected: AnalyzeActionCenterItem, previous: AnalyzeSubpackagesResult | null = null) {
  return createDiagnosticEvidence({
    action: selected,
    result,
    previous,
    duplicateModules: createDuplicateModules({ result, packageLabelMap: new Map(result.packages.map(pkg => [pkg.id, pkg.label])) }),
    incrementAttribution: createIncrementAttribution({ result, previousResult: previous }),
  })
}

function budget(result: AnalyzeSubpackagesResult, id: string): AnalyzeActionCenterItem {
  return { ...action('budget', `budget:${id}`), warning: createBudgetWarnings(result).find(item => item.id === id)! }
}

function selectedFile(result: AnalyzeSubpackagesResult, packageId: string, path: string): AnalyzeActionCenterItem {
  return { ...action('increment', `increment:file:${packageId}:${path}`), file: createLargestFiles(result, new Map()).find(item => item.packageId === packageId && item.file === path)! }
}

describe('diagnostic evidence boundaries', () => {
  it('keeps package, physical total and runtime scopes distinct', () => {
    const result = report([
      pkg('main', [file('shared.js', 90)]),
      pkg('feature', [file('shared.js', 90), { ...file('picture.png', 30), type: 'asset' }], 'subPackage'),
    ])
    expect(evidence(result, budget(result, 'main'))).toMatchObject({ classification: 'risk', currentBytes: 90, artifactCount: 1 })
    expect(evidence(result, budget(result, 'feature')).artifacts.map(item => item.entry.packageId)).toEqual(['feature', 'feature'])
    expect(evidence(result, budget(result, '__total__'))).toMatchObject({ classification: 'problem', currentBytes: 120, artifactCount: 3 })
    expect(evidence(result, budget(result, '__runtime__'))).toMatchObject({ classification: 'unknown', currentBytes: null, measurement: 'unavailable', artifactCount: 2 })
    result.artifacts = {
      totalBytes: 120,
      duplicateEstimatedBytes: 0,
      runtime: { estimatedBytes: 10, upperBoundBytes: 90, unknownFiles: [] },
      files: [{
        file: 'shared.js',
        packageId: 'main',
        origin: 'main',
        type: 'chunk',
        bytes: 90,
        role: 'mixed',
        classification: 'module-ownership',
        estimation: 'rendered-length-proportional',
        modules: [{ source: 'runtime.ts', category: 'runtime', estimatedBytes: 10 }],
        runtimeEstimatedBytes: 10,
        unattributedBytes: 0,
      }],
    }
    expect(evidence(result, budget(result, '__runtime__'))).toMatchObject({ classification: 'problem', currentBytes: 90, limitBytes: 50, measurement: 'upper-bound' })
    expect(evidence(result, budget(result, '__runtime__')).artifacts.map(item => item.entry.file)).toEqual(['shared.js', 'shared.js'])
  })

  it('distinguishes absent baselines, new files and missing measurements on either side', () => {
    const current = report([pkg('main', [file('app.js', 100)])])
    const selected = selectedFile(current, 'main', 'app.js')
    expect(evidence(current, selected)).toMatchObject({ currentBytes: 100, previousBytes: null, deltaBytes: null })
    expect(evidence(current, selected, report([]))).toMatchObject({ currentBytes: 100, previousBytes: 0, deltaBytes: 100 })
    const unknown = report([pkg('main', [file('app.js')])])
    expect(evidence(current, selected, unknown)).toMatchObject({ currentBytes: 100, previousBytes: null, deltaBytes: null })
    const missing = evidence(unknown, selected, current)
    expect(missing).toMatchObject({ classification: 'unknown', currentBytes: null, previousBytes: 100, deltaBytes: null })
    expect(missing.artifacts[0]).toMatchObject({ bytes: null, previousBytes: 100, deltaBytes: null })
    expect(evidence(unknown, budget(unknown, 'main'))).toMatchObject({ classification: 'unknown', currentBytes: null })
  })

  it('uses canonical module growth without adding the containing artifact delta', () => {
    const previous = report([pkg('main', [{ ...file('app.js', 500), modules: [{ id: 'old', source: 'components/Card.vue?old', sourceType: 'src', bytes: 100 }] }])])
    const current = report([pkg('main', [{ ...file('app.js', 1000), modules: [{ id: 'new', source: 'components/Card.vue?new', sourceType: 'src', bytes: 150 }] }])])
    const value = evidence(current, action('increment', 'increment:module:new'), previous)
    expect(value).toMatchObject({ classification: 'clue', currentBytes: 150, previousBytes: 100, deltaBytes: 50, measurement: 'upper-bound' })
    expect(value.artifacts[0]).toMatchObject({ bytes: 1000, previousBytes: 500, deltaBytes: 500 })
    expect(value.sources[0]?.meta).toMatchObject({ nodeId: createTreemapModuleNodeId('main', 'app.js', 'new'), source: 'components/Card.vue?new' })
    const withoutBaseline = createDiagnosticEvidence({
      action: action('increment', 'increment:module:new'),
      result: current,
      previous: null,
      duplicateModules: [],
      incrementAttribution: createIncrementAttribution({ result: current, previousResult: previous }),
    })
    expect(withoutBaseline).toMatchObject({ classification: 'unknown', currentBytes: 150, previousBytes: null, deltaBytes: null })
  })

  it.each<{
    state: string
    copies: Array<Pick<ModuleInFile, 'bytes' | 'originalBytes'>>
    canonicalEstimate: number
    expectedBytes: number | null
  }>([
    { state: 'measured', copies: [{ bytes: 80 }, { originalBytes: 120 }], canonicalEstimate: 120, expectedBytes: 120 },
    { state: 'partial', copies: [{ bytes: 80 }, {}], canonicalEstimate: 80, expectedBytes: null },
    { state: 'missing', copies: [{}, {}], canonicalEstimate: 0, expectedBytes: null },
  ])('keeps $state duplicate measurements consistent across the action, commands, queue and evidence', ({ copies, canonicalEstimate, expectedBytes }) => {
    const module = { id: 'shared', source: 'shared/util.ts', sourceType: 'src' as const }
    const current = report([
      pkg('main', [{ ...file('app.js', 200), modules: [{ ...module, ...copies[0] }] }]),
      pkg('isolated', [{ ...file('isolated/index.js', 300), modules: [{ ...module, ...copies[1] }] }], 'independent'),
    ])
    current.modules = [{ ...module, packages: [{ packageId: 'main', files: ['app.js'] }, { packageId: 'isolated', files: ['isolated/index.js'] }] }]
    const resultRef = shallowRef(current)
    const data = useAnalyzeDashboardData(resultRef)
    const { actionItems } = useAnalyzeActionCenter({ ...data, resultRef })
    const { commandItems } = useAnalyzeCommandPalette({ ...data, resultRef, actionItems })
    expect(data.duplicateModules.value[0]?.estimatedSavingBytes).toBe(canonicalEstimate)
    const selected = actionItems.value.find(item => item.key === 'duplicate:shared')!
    expect(selected).toMatchObject({ kind: 'duplicate', measurementUnknown: expectedBytes === null })
    const value = evidence(current, selected, report([]))
    expect(value).toMatchObject({
      classification: expectedBytes === null ? 'unknown' : 'clue',
      currentBytes: expectedBytes,
      previousBytes: 0,
      deltaBytes: expectedBytes,
      measurement: 'upper-bound',
      artifactCount: 2,
      sourceCount: 2,
    })
    expect(value.sources.map(source => source.readable)).toEqual([true, true])
    expect(evidence(current, selected).previousBytes).toBeNull()
    expect(evidence(current, selected, current)).toMatchObject({
      previousBytes: expectedBytes,
      deltaBytes: expectedBytes === null ? null : 0,
    })
    const displayValues = [
      selected.value,
      commandItems.value.find(item => item.key === 'action:duplicate:shared')?.value,
      commandItems.value.find(item => item.key === 'module:shared')?.value,
      createActionWorkQueueItem(selected).value,
    ]
    for (const display of displayValues) {
      if (expectedBytes === null) {
        expect(display).toEqual(expect.any(String))
        expect(display).not.toMatch(/\d/)
      }
      else {
        expect(display).toContain(formatBytes(expectedBytes))
      }
    }
  })

  it('bounds deterministic rows while retaining full placement counts', () => {
    const current = report([pkg('main', Array.from({ length: 20 }, (_, index) => ({
      ...file(`part-${String(index).padStart(2, '0')}.js`, index + 100),
      modules: [{ id: `module-${index}`, source: `src/module-${index}.ts`, sourceType: 'src' as const, bytes: index + 10 }],
    })))])
    const selected = budget(current, 'main')
    const value = evidence(current, selected)
    expect(value).toMatchObject({ artifactCount: 20, sourceCount: 20, currentBytes: 2190 })
    expect(value.artifacts.map(item => item.entry.file)).toEqual(Array.from({ length: 12 }, (_, index) => `part-${String(19 - index).padStart(2, '0')}.js`))
    expect(value.sources).toHaveLength(16)
    current.packages[0]!.files.reverse()
    expect(evidence(current, selected)).toEqual(value)
  })

  it('retains source-only asset references without inventing module byte measurements', () => {
    const current = report([pkg('main', [{ ...file('pages/home.wxss', 20), type: 'asset' }])])
    current.modules = [{ id: 'style', source: 'pages/home.scss?inline', sourceType: 'src', packages: [{ packageId: 'main', files: ['pages/home.wxss'] }] }]
    const value = evidence(current, selectedFile(current, 'main', 'pages/home.wxss'))
    expect(value.sources).toEqual([{
      id: createTreemapModuleNodeId('main', 'pages/home.wxss', 'style'),
      bytes: null,
      readable: false,
      meta: {
        kind: 'module',
        nodeId: createTreemapModuleNodeId('main', 'pages/home.wxss', 'style'),
        packageId: 'main',
        packageLabel: 'main',
        fileName: 'pages/home.wxss',
        source: 'pages/home.scss?inline',
        sourceType: 'src',
        bytes: undefined,
        originalBytes: undefined,
        packageCount: 1,
      },
    }])
    const artifact = current.packages[0]!.files[0]!
    artifact.modules = [{ id: 'style', source: 'pages/home.scss?raw', sourceType: 'src', bytes: 12 }]
    expect(evidence(current, selectedFile(current, 'main', artifact.file)).sources).toMatchObject([{
      id: createTreemapModuleNodeId('main', artifact.file, 'style'),
      bytes: 12,
      readable: true,
      meta: { source: 'pages/home.scss?raw', bytes: 12 },
    }])
    artifact.modules[0]!.sourceType = 'node_modules'
    expect(evidence(current, selectedFile(current, 'main', artifact.file)).sources[0]?.readable).toBe(false)
    artifact.modules[0]!.sourceType = 'src'
    artifact.modules[0]!.source = ''
    expect(evidence(current, selectedFile(current, 'main', artifact.file)).sources[0]?.readable).toBe(false)
  })
})
