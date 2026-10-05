import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { AnalyzeActionCenterItem, AnalyzeCommandPaletteItem, AnalyzeSubpackagesResult, AnalyzeWorkQueueItem, DuplicateModuleEntry, LargestFileEntry, PackageBudgetWarning, PackageInsight, TreemapNodeMeta } from '../types'
import { describe, expect, it } from 'vitest'
import { createSSRApp, h, ref, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { createTreemapModuleNodeId } from '../utils/treemap'
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
  duplicateModuleScopeLabel: Ref<string | null>
  filteredDuplicateModules: Ref<DuplicateModuleEntry[]>
  filteredLargestFiles: Ref<LargestFileEntry[]>
  selectedLargestFile: Ref<LargestFileEntry | null>
  selectedBudgetWarning: Ref<PackageBudgetWarning | null>
  selectedTreemapMeta: Ref<TreemapNodeMeta | null>
  handleInspectPackageDuplicates: (packageId: string) => void
  handleResetTreemapFocus: () => Promise<void>
  handleSelectLargestFile: (file: LargestFileEntry) => void
  handleSelectPackageInsight: (item: PackageInsight) => void
  handleSelectAction: (item: AnalyzeActionCenterItem) => void
  handleSelectCommand: (item: AnalyzeCommandPaletteItem) => void
}

function createSession(): NavigationSession {
  const resultRef = shallowRef<AnalyzeSubpackagesResult>({
    packages: [
      {
        id: 'main',
        label: '主包 A',
        type: 'main',
        files: [{
          file: 'main/runtime.js',
          type: 'chunk',
          from: 'main',
          size: 300,
          modules: [{ id: 'main-shared', source: 'src/main-shared.ts', sourceType: 'src', bytes: 100 }],
        }],
      },
      {
        id: 'feature',
        label: '功能包 B',
        type: 'subPackage',
        files: [{
          file: 'feature/runtime.js',
          type: 'chunk',
          from: 'main',
          size: 200,
          modules: [{ id: 'feature-shared', source: 'src/feature-shared.ts', sourceType: 'src', bytes: 80 }],
        }],
      },
      { id: 'other', label: 'other', type: 'subPackage', files: [{ file: 'other/image.png', type: 'asset', from: 'main', size: 10 }] },
      {
        id: 'independent',
        label: '独立包',
        type: 'independent',
        files: [{
          file: 'independent/vendor.js',
          type: 'chunk',
          from: 'independent',
          size: 180,
          modules: [
            { id: 'main-shared', source: 'src/main-shared.ts', sourceType: 'src', bytes: 100 },
            { id: 'feature-shared', source: 'src/feature-shared.ts', sourceType: 'src', bytes: 80 },
          ],
        }],
      },
    ],
    modules: [
      {
        id: 'main-shared',
        source: 'src/main-shared.ts',
        sourceType: 'src',
        packages: [
          { packageId: 'main', files: ['main/runtime.js'] },
          { packageId: 'independent', files: ['independent/vendor.js'] },
        ],
      },
      {
        id: 'feature-shared',
        source: 'src/feature-shared.ts',
        sourceType: 'src',
        packages: [
          { packageId: 'feature', files: ['feature/runtime.js'] },
          { packageId: 'independent', files: ['independent/vendor.js'] },
        ],
      },
    ],
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

  it.each([
    { packageId: 'main', label: '主包 A', moduleId: 'main-shared', file: 'main/runtime.js', tab: 'treemap', filter: 'duplicates' },
    { packageId: 'feature', label: '功能包 B', moduleId: 'feature-shared', file: 'feature/runtime.js', tab: 'packages', filter: 'node_modules' },
  ])('opens only $packageId duplicate entries and retains all contributing packages', async ({ packageId, label, moduleId, file, tab, filter }) => {
    const { router, session } = await createHarness()
    await navigate(router, () => session.handleSelectAction(session.actionItems.value.find(item => item.warning?.scope === 'runtime')!))
    session.handleSelectLargestFile(session.filteredLargestFiles.value.find(item => item.packageId !== packageId)!)
    await router.replace({ query: { tab, filter, color: 'source' } })
    expect(session.selectedBudgetWarning.value?.scope).toBe('runtime')
    expect(session.selectedLargestFile.value).not.toBeNull()

    const visitedTabs: unknown[] = []
    const stop = router.afterEach((to, _from, failure) => {
      if (!failure) {
        visitedTabs.push(to.query.tab)
      }
    })
    await navigate(router, () => session.handleInspectPackageDuplicates(packageId))
    stop()

    expect(visitedTabs).toEqual(['modules'])
    expect(router.currentRoute.value.query).toEqual({ tab: 'modules', filter: 'selected-package', color: 'source' })
    expect(session.selectedTreemapMeta.value).toMatchObject({ kind: 'package', packageId })
    expect(session.selectedLargestFile.value).toBeNull()
    expect(session.selectedBudgetWarning.value).toBeNull()
    expect(session.duplicateModuleScopeLabel.value).toContain(label)
    expect(session.filteredDuplicateModules.value.map(item => item.id)).toEqual([moduleId])
    expect(session.filteredDuplicateModules.value[0]?.packages).toEqual([
      { packageId, packageLabel: label, files: [file] },
      { packageId: 'independent', packageLabel: '独立包', files: ['independent/vendor.js'] },
    ])
  })

  it('replaces a previous module selection, switches package scope and clears back to all modules', async () => {
    const { router, session } = await createHarness()
    await router.replace({ query: { tab: 'modules', color: 'source' } })
    expect(session.filteredDuplicateModules.value.map(item => item.id).sort()).toEqual(['feature-shared', 'main-shared'])
    expect(session.duplicateModuleScopeLabel.value).toBeNull()

    await navigate(router, () => session.handleSelectCommand(session.commandItems.value.find(item => item.kind === 'module' && item.moduleMeta?.packageId === 'main')!))
    expect(session.filteredDuplicateModules.value.map(item => item.id)).toEqual(['main-shared'])

    await navigate(router, () => session.handleInspectPackageDuplicates('feature'))
    expect(session.filteredDuplicateModules.value.map(item => item.id)).toEqual(['feature-shared'])
    session.handleInspectPackageDuplicates('main')
    expect(session.filteredDuplicateModules.value.map(item => item.id)).toEqual(['main-shared'])

    await session.handleResetTreemapFocus()
    expect(router.currentRoute.value.query).toEqual({ tab: 'modules', color: 'source' })
    expect(session.selectedTreemapMeta.value).toBeNull()
    expect(session.duplicateModuleScopeLabel.value).toBeNull()
    expect(session.filteredDuplicateModules.value.map(item => item.id).sort()).toEqual(['feature-shared', 'main-shared'])
  })

  it('keeps a valid empty package scope visible and ignores unknown package ids', async () => {
    const { router, session } = await createHarness()
    await navigate(router, () => session.handleInspectPackageDuplicates('other'))
    expect(session.filteredDuplicateModules.value).toEqual([])
    expect(session.duplicateModuleScopeLabel.value).toContain('other')

    session.handleInspectPackageDuplicates('missing')
    expect(session.selectedTreemapMeta.value).toMatchObject({ kind: 'package', packageId: 'other' })
    expect(session.filteredDuplicateModules.value).toEqual([])
    expect(router.currentRoute.value.query).toEqual({ tab: 'modules', filter: 'selected-package' })
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
      nodeId: createTreemapModuleNodeId('feature', 'feature/runtime.js', 'feature-shared'),
      packageId: 'feature',
      packageLabel: 'feature',
      fileName: 'feature/runtime.js',
      source: 'src/feature-shared.ts',
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
    expect(session.filteredDuplicateModules.value.map(item => item.id)).toEqual(['feature-shared'])
    expect(session.duplicateModuleScopeLabel.value).toContain('src/feature-shared.ts')
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
    expect(session.filteredLargestFiles.value.map(file => file.file).sort()).toEqual(['feature/runtime.js', 'independent/vendor.js', 'main/runtime.js'])
    expect(session.selectedLargestFile.value?.file).toBe('main/runtime.js')
    expect(session.selectedTreemapMeta.value).toBeNull()
  })
})
