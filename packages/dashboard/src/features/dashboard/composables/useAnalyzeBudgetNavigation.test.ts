import type { Ref } from 'vue'
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

interface BudgetNavigationSession {
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

function createSession(): BudgetNavigationSession {
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
  let session!: BudgetNavigationSession
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

describe('budget navigation', () => {
  it.each(['action', 'command'] as const)('keeps all runtime contributors when selecting a %s', async (entry) => {
    const { router, session } = await createHarness()
    if (entry === 'command') {
      session.handleSelectPackageInsight(session.packageInsights.value.find(item => item.id === 'other')!)
      await router.replace({ query: { tab: 'overview', filter: 'selected-package' } })
      expect(session.filteredLargestFiles.value.map(file => file.file)).toEqual(['other/image.png'])
    }
    const navigated = new Promise<void>((resolve) => {
      const stop = router.afterEach((_to, _from, failure) => {
        if (!failure) {
          stop()
          resolve()
        }
      })
    })
    if (entry === 'action') {
      session.handleSelectAction(session.actionItems.value.find(item => item.warning?.scope === 'runtime')!)
    }
    else {
      session.handleSelectCommand(session.commandItems.value.find(item => item.warning?.scope === 'runtime' && !item.action)!)
    }
    await navigated
    expect(router.currentRoute.value.query).toEqual({ tab: 'files' })
    expect(session.filteredLargestFiles.value.map(file => file.file).sort()).toEqual(['feature/runtime.js', 'main/runtime.js'])
    expect(session.selectedLargestFile.value?.file).toBe('main/runtime.js')
    expect(session.selectedTreemapMeta.value).toBeNull()
  })
})
