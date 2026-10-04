import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { AnalyzeActionCenterItem, AnalyzeCommandPaletteItem, AnalyzeSubpackagesResult, AnalyzeWorkQueueItem, LargestFileEntry, PackageInsight, TreemapNodeMeta } from '../types'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h, ref, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { useAnalyzeActionCenter } from './useAnalyzeActionCenter'
import { useAnalyzeCommandPalette } from './useAnalyzeCommandPalette'
import { useAnalyzeDashboardData } from './useAnalyzeDashboardData'
import { useAnalyzePageInteractions } from './useAnalyzePageInteractions'
import { useAnalyzeTreemapController } from './useAnalyzeTreemapController'
import { useDashboardPage } from './useDashboardPage'

interface NavigationSession {
  packageInsights: Ref<PackageInsight[]>
  actionItems: Ref<AnalyzeActionCenterItem[]>
  commandItems: Ref<AnalyzeCommandPaletteItem[]>
  filteredLargestFiles: Ref<LargestFileEntry[]>
  selectedLargestFile: Ref<LargestFileEntry | null>
  selectedTreemapMeta: Ref<TreemapNodeMeta | null>
  handleSelectPackageInsight: (item: PackageInsight) => void
  handleSelectAction: (item: AnalyzeActionCenterItem) => void
  handleSelectCommand: (item: AnalyzeCommandPaletteItem) => void
}

function createSession(): NavigationSession {
  const resultRef = shallowRef<AnalyzeSubpackagesResult>({
    packages: [
      { id: 'main', label: 'main', type: 'main', files: [{ file: 'main/runtime.js', type: 'chunk', from: 'main', size: 300 }] },
      { id: 'feature', label: 'feature', type: 'subPackage', files: [{ file: 'feature/runtime.js', type: 'chunk', from: 'main', size: 200 }] },
      { id: 'other', label: 'other', type: 'subPackage', files: [{ file: 'other/image.png', type: 'asset', from: 'main', size: 10 }] },
    ],
    modules: [],
    subPackages: [],
    metadata: {
      generatedAt: '',
      history: { enabled: false, dir: '', limit: 0 },
      budgets: { totalBytes: 2000, mainBytes: 1000, subPackageBytes: 1000, independentBytes: 1000, runtimeBytes: 50, warningRatio: 0.85, source: 'config' },
    },
  })
  const comparisonResultRef = shallowRef(null)
  const data = useAnalyzeDashboardData(resultRef, comparisonResultRef)
  const { activeTab } = useDashboardPage({ ...data, lastUpdatedAt: ref('') })
  const treemap = useAnalyzeTreemapController({
    ...data,
    activeTab,
    resultRef,
    comparisonResultRef,
    resolvedTheme: ref('light'),
    largestFiles: data.artifactFiles,
  })
  const { actionItems } = useAnalyzeActionCenter(data)
  const { commandItems } = useAnalyzeCommandPalette({ ...data, actionItems })
  const workQueueItems = shallowRef<AnalyzeWorkQueueItem[]>([])
  const interactions = useAnalyzePageInteractions({
    ...treemap,
    activeTab,
    actionItems,
    workQueueItems,
    addWorkQueueItem: item => workQueueItems.value.push(item),
    exportStatus: ref(''),
  })
  return { ...treemap, ...interactions, ...data, actionItems, commandItems }
}

async function createHarness() {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/', component: { render: () => h('div') } }] })
  await router.push('/')
  let session!: NavigationSession
  const app = createSSRApp({
    setup() {
      session = createSession()
      return () => h('div')
    },
  })
  app.use(router)
  await renderToString(app)
  return { router, session }
}

function navigate(router: Router, action: () => void) {
  return new Promise<void>((resolve) => {
    const stop = router.afterEach((_to, _from, failure) => {
      if (!failure) {
        stop()
        resolve()
      }
    })
    action()
  })
}

describe('analyze navigation', () => {
  it.each(['overview', 'treemap'] as const)('selects a package and its tab together from %s', async (tab) => {
    const { router, session } = await createHarness()
    await router.replace({ query: { tab, color: 'source', filter: 'duplicates' } })
    const pkg = session.packageInsights.value.find(item => item.id === 'feature')!

    await navigate(router, () => session.handleSelectPackageInsight(pkg))

    expect(router.currentRoute.value.query).toEqual({ tab: 'packages', color: 'source', filter: 'selected-package' })
    expect(session.selectedTreemapMeta.value).toMatchObject({ kind: 'package', packageId: 'feature' })
    expect(session.selectedLargestFile.value).toBeNull()
    expect(session.filteredLargestFiles.value.map(file => file.file)).toEqual(['feature/runtime.js'])

    session.handleSelectPackageInsight(session.packageInsights.value.find(item => item.id === 'other')!)
    expect(session.filteredLargestFiles.value.map(file => file.file)).toEqual(['other/image.png'])
  })

  it.each(['package', 'file', 'action'] as const)('opens a search %s with its selection and preserves unrelated query', async (kind) => {
    const { router, session } = await createHarness()
    await router.replace({ query: { tab: 'review', color: 'source', filter: 'duplicates' } })
    const item = session.commandItems.value.find(item => item.kind === kind && (kind !== 'action' || item.action?.kind === 'file'))!

    await navigate(router, () => session.handleSelectCommand(item))

    expect(router.currentRoute.value.query).toEqual({ tab: kind === 'package' ? 'packages' : 'files', color: 'source', filter: 'selected-package' })
    expect(session.selectedTreemapMeta.value?.packageId).toBe(item.packageMeta?.packageId ?? item.file?.packageId)
    expect(session.filteredLargestFiles.value.map(file => file.packageId)).toEqual([session.selectedTreemapMeta.value?.packageId])
    if (item.file) {
      expect(session.selectedLargestFile.value?.file).toBe(item.file.file)
    }
  })

  it.each([
    { entry: 'action', kind: 'duplicate', filter: 'duplicates' },
    { entry: 'action', kind: 'increment', filter: 'growth' },
    { entry: 'command', kind: 'module', filter: 'duplicates' },
    { entry: 'command', kind: 'increment', filter: 'growth' },
  ] as const)('opens $entry $kind with its module filter', async ({ entry, kind, filter }) => {
    const { router, session } = await createHarness()
    await router.replace({ query: { tab: 'files', color: 'delta', filter: 'selected-package' } })
    const moduleMeta: TreemapNodeMeta = {
      kind: 'module',
      nodeId: 'feature-module',
      packageId: 'feature',
      packageLabel: 'feature',
      fileName: 'feature/runtime.js',
      source: 'src/shared.ts',
      sourceType: 'src',
      bytes: 200,
      packageCount: 2,
    }
    const item = { key: 'module', title: 'shared module', meta: '', tab: 'modules' as const, moduleMeta }

    await navigate(router, () => {
      if (entry === 'action') {
        session.handleSelectAction({ ...item, kind, tone: 'info', priority: 1 })
      }
      else {
        session.handleSelectCommand({ ...item, kind, keywords: 'shared' })
      }
    })

    expect(router.currentRoute.value.query).toEqual({ tab: 'modules', color: 'delta', filter })
    expect(session.selectedTreemapMeta.value).toEqual(moduleMeta)
    expect(session.selectedLargestFile.value).toBeNull()
  })
})

describe('budget navigation', () => {
  it.each(['action', 'command'] as const)('keeps all runtime contributors when selecting a %s', async (entry) => {
    const { router, session } = await createHarness()
    if (entry === 'command') {
      session.handleSelectPackageInsight(session.packageInsights.value.find(item => item.id === 'other')!)
      await router.replace({ query: { tab: 'overview', filter: 'selected-package' } })
      expect(session.filteredLargestFiles.value.map(file => file.file)).toEqual(['other/image.png'])
    }
    await navigate(router, () => {
      if (entry === 'action') {
        session.handleSelectAction(session.actionItems.value.find(item => item.warning?.scope === 'runtime')!)
      }
      else {
        session.handleSelectCommand(session.commandItems.value.find(item => item.warning?.scope === 'runtime' && !item.action)!)
      }
    })
    expect(router.currentRoute.value.query).toEqual({ tab: 'files' })
    expect(session.filteredLargestFiles.value.map(file => file.file).sort()).toEqual(['feature/runtime.js', 'main/runtime.js'])
    expect(session.selectedLargestFile.value?.file).toBe('main/runtime.js')
    expect(session.selectedTreemapMeta.value).toBeNull()
  })
})
