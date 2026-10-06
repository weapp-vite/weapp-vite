import type { Ref } from 'vue'
import type { Router } from 'vue-router'
import type { DashboardInvestigationTarget } from 'weapp-vite/dashboard'
import type { AnalyzeActionCenterItem, AnalyzeCommandPaletteItem, AnalyzeSubpackagesResult, AnalyzeWorkQueueItem, DashboardTab, DuplicateModuleEntry, LargestFileEntry, PackageBudgetWarning, PackageInsight, TreemapModuleNodeMeta, TreemapNodeMeta } from '../types'
import { describe, expect, it, vi } from 'vitest'
import { createSSRApp, h, ref, shallowRef } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { renderToString } from 'vue/server-renderer'
import { createTreemapModuleNodeId, createTreemapPackageNodeId } from '../utils/treemap'
import { useAnalyzeActionCenter } from './useAnalyzeActionCenter'
import { useAnalyzeCommandPalette } from './useAnalyzeCommandPalette'
import { useAnalyzeDashboardData } from './useAnalyzeDashboardData'
import { useAnalyzePageInteractions } from './useAnalyzePageInteractions'
import { useAnalyzeTreemapController } from './useAnalyzeTreemapController'
import { useDashboardPage } from './useDashboardPage'
import { useObjectInspectionNavigation } from './useObjectInspectionNavigation'

interface NavigationSession {
  activeTab: Ref<DashboardTab>
  artifactFiles: Ref<LargestFileEntry[]>
  packageInsights: Ref<PackageInsight[]>
  actionItems: Ref<AnalyzeActionCenterItem[]>
  commandItems: Ref<AnalyzeCommandPaletteItem[]>
  selectedActionKey: Ref<string | null>
  duplicateModuleScopeLabel: Ref<string | null>
  filteredDuplicateModules: Ref<DuplicateModuleEntry[]>
  filteredLargestFiles: Ref<LargestFileEntry[]>
  selectedLargestFile: Ref<LargestFileEntry | null>
  selectedBudgetWarning: Ref<PackageBudgetWarning | null>
  selectedTreemapMeta: Ref<TreemapNodeMeta | null>
  inspectionTarget: Ref<DashboardInvestigationTarget | null>
  inspectionSourcePath: Ref<string | null>
  investigationRequest: Ref<DashboardInvestigationTarget | null>
  investigationRequestId: Ref<number>
  handleOpenFile: (file: LargestFileEntry) => void
  handleOpenInspectionSource: (meta: TreemapNodeMeta) => void
  handleSelectInspectionTarget: (target: DashboardInvestigationTarget) => void
  handleCreateObjectInvestigation: (target: DashboardInvestigationTarget) => void
  handleInspectPackageDuplicates: (packageId: string) => void
  handleResetTreemapFocus: () => Promise<void>
  handleSelectLargestFile: (file: LargestFileEntry) => void
  handleSelectPackageInsight: (item: PackageInsight) => void
  handleFocusAction: (item: AnalyzeActionCenterItem) => void
  handleSelectAction: (item: AnalyzeActionCenterItem) => void
  handleSelectCommand: (item: AnalyzeCommandPaletteItem) => void
}

function createSession(additionalPackages: AnalyzeSubpackagesResult['packages'], additionalModules: AnalyzeSubpackagesResult['modules']): NavigationSession {
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
      ...additionalPackages,
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
      ...additionalModules,
    ],
    subPackages: [],
    metadata: {
      generatedAt: '',
      history: { enabled: false, dir: '', limit: 0 },
      budgets: { totalBytes: 2000, mainBytes: 250, subPackageBytes: 1000, independentBytes: 1000, runtimeBytes: 50, warningRatio: 0.85, source: 'config' },
    },
  })
  const comparisonResultRef = shallowRef(null)
  const data = useAnalyzeDashboardData(resultRef, comparisonResultRef)
  const { activeTab } = useDashboardPage({ ...data, lastUpdatedAt: ref('') })
  const inspection = useObjectInspectionNavigation({ resultRef, activeTab })
  const treemap = useAnalyzeTreemapController({
    ...data,
    activeTab,
    resultRef,
    comparisonResultRef,
    resolvedTheme: ref('light'),
    largestFiles: data.artifactFiles,
  })
  const { actionItems } = useAnalyzeActionCenter({ ...data, resultRef })
  const { commandItems } = useAnalyzeCommandPalette({ ...data, actionItems, resultRef })
  const workQueueItems = shallowRef<AnalyzeWorkQueueItem[]>([])
  const interactions = useAnalyzePageInteractions({
    ...treemap,
    activeTab,
    actionItems,
    workQueueItems,
    addWorkQueueItem: item => workQueueItems.value.push(item),
    openInspectionFile: inspection.handleOpenInspectionFile,
    exportStatus: ref(''),
  })
  return { ...treemap, ...interactions, ...inspection, ...data, activeTab, actionItems, commandItems }
}

async function createHarness(additionalPackages: AnalyzeSubpackagesResult['packages'] = [], additionalModules: AnalyzeSubpackagesResult['modules'] = []) {
  const router = createRouter({ history: createMemoryHistory(), routes: [{ path: '/analyze', component: { render: () => h('div') } }] })
  await router.push('/analyze')
  let session!: NavigationSession
  const app = createSSRApp({
    setup() {
      session = createSession(additionalPackages, additionalModules)
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
  it.each([undefined, 'diagnostics', 'unknown-tab'])('keeps issue selection in the evidence workspace for tab %s until an explicit drilldown', async (tab) => {
    const { router, session } = await createHarness()
    const query = tab === undefined ? { color: 'delta' } : { tab, color: 'delta' }
    await router.replace({ query })
    expect(session.activeTab.value).toBe('diagnostics')
    const item = session.actionItems.value.find(item => item.kind === 'duplicate')!

    session.handleFocusAction(item)

    expect(router.currentRoute.value.query).toEqual(query)
    expect(session.selectedActionKey.value).toBe(item.key)
    expect(session.selectedTreemapMeta.value).toBeNull()

    await navigate(router, () => session.handleSelectAction(item))

    expect(router.currentRoute.value.query).toEqual({ tab: 'modules', color: 'delta', filter: 'duplicates' })
    expect(session.selectedTreemapMeta.value).toMatchObject({ kind: 'module', source: item.moduleMeta?.source })

    await navigate(router, () => {
      session.activeTab.value = 'diagnostics'
    })

    expect(router.currentRoute.value.query).toEqual({ color: 'delta', filter: 'duplicates' })
    expect(session.activeTab.value).toBe('diagnostics')
  })

  it.each(['diagnostics', 'treemap'] as const)('selects a package and its tab together from %s', async (tab) => {
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

  it.each(['package', 'file'] as const)('opens a search %s with its selection and preserves unrelated query', async (kind) => {
    const { router, session } = await createHarness()
    await router.replace({ query: { tab: 'review', color: 'source', filter: 'duplicates' } })
    const item = session.commandItems.value.find(item => item.kind === kind)!

    await navigate(router, () => session.handleSelectCommand(item))

    if (item.file) {
      expect(router.currentRoute.value.query).toEqual({ tab: 'files', color: 'source', filter: 'duplicates' })
      expect(session.inspectionTarget.value).toEqual({ kind: 'artifact', packageId: item.file.packageId, file: item.file.file })
      expect(session.selectedTreemapMeta.value).toBeNull()
      expect(session.filteredLargestFiles.value.map(file => file.packageId)).toEqual(['main', 'feature', 'independent'])
    }
    else {
      expect(router.currentRoute.value.query).toEqual({ tab: 'packages', color: 'source', filter: 'selected-package' })
      expect(session.selectedTreemapMeta.value?.packageId).toBe(item.packageMeta?.packageId)
      expect(session.filteredLargestFiles.value.map(file => file.packageId)).toEqual([item.packageMeta?.packageId])
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
        session.handleSelectAction({ ...item, kind, targetLabel: moduleMeta.source, tone: 'info', priority: 1 })
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
      await router.replace({ query: { tab: 'diagnostics', filter: 'selected-package' } })
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
    expect(router.currentRoute.value.query).toEqual({ tab: 'packages' })
    expect(session.filteredLargestFiles.value.map(file => file.file).sort()).toEqual(['feature/runtime.js', 'independent/vendor.js', 'main/runtime.js'])
    expect(session.selectedLargestFile.value?.file).toBe('main/runtime.js')
    expect(session.selectedTreemapMeta.value).toBeNull()
  })
})

describe('explicit evidence navigation', () => {
  const sourcePackage: AnalyzeSubpackagesResult['packages'][number] = {
    id: 'source-only',
    label: '独立来源',
    type: 'subPackage',
    files: [
      {
        file: 'source-only/page.js',
        type: 'chunk',
        from: 'main',
        size: 70,
        modules: [
          { id: 'helper', source: 'src/helper.ts', sourceType: 'src', bytes: 20 },
          { id: 'page', source: 'src/Page.vue?vue&type=script', sourceType: 'src', bytes: 50 },
          { id: 'unreadable', source: '', sourceType: 'src', bytes: 0 },
        ],
      },
      {
        file: 'source-only/dependency.js',
        type: 'chunk',
        from: 'main',
        size: 30,
        modules: [{ id: 'dependency', source: 'node_modules/dependency/index.js', sourceType: 'node_modules', bytes: 30 }],
      },
    ],
  }

  function moduleMeta(file: LargestFileEntry, moduleId: string): TreemapModuleNodeMeta {
    const module = file.modules!.find(module => module.id === moduleId)!
    return {
      kind: 'module',
      nodeId: createTreemapModuleNodeId(file.packageId, file.file, module.id),
      packageId: file.packageId,
      packageLabel: file.packageLabel,
      fileName: file.file,
      source: module.source,
      sourceType: module.sourceType,
      bytes: module.bytes,
      packageCount: 1,
    }
  }

  it.each([
    { scope: 'main', packageId: 'feature', fileName: 'feature/runtime.js' },
    { scope: 'runtime', packageId: 'other', fileName: 'other/image.png' },
  ])('opens a new artifact after leaving the $scope budget without narrowing in-file budget browsing', async ({ scope, packageId, fileName }) => {
    const { router, session } = await createHarness()
    const budget = session.actionItems.value.find(item => item.warning?.scope === scope)!
    await navigate(router, () => session.handleSelectAction(budget))
    const budgetFiles = session.filteredLargestFiles.value
    session.handleSelectLargestFile(budgetFiles.at(-1)!)
    expect(session.selectedBudgetWarning.value).toEqual(budget.warning)
    expect(session.filteredLargestFiles.value).toEqual(budgetFiles)

    await router.replace({ query: { tab: 'diagnostics', filter: 'duplicates', color: 'source', search: 'keep' } })
    const target = session.artifactFiles.value.find(file => file.packageId === packageId && file.file === fileName)!
    await navigate(router, () => session.handleOpenFile(target))

    expect(router.currentRoute.value.query).toEqual({ tab: 'files', filter: 'duplicates', color: 'source', search: 'keep' })
    expect(session.selectedBudgetWarning.value).toBeNull()
    expect(session.inspectionTarget.value).toEqual({ kind: 'artifact', packageId, file: fileName })
    expect(session.filteredLargestFiles.value.map(file => file.packageId)).toEqual(['main', 'feature', 'independent'])
  })

  it.each(['growth', 'duplicates', 'node_modules'] as const)('opens the clicked raw source atomically from a mismatching %s deep-link', async (filter) => {
    const { router, session } = await createHarness([sourcePackage])
    await router.replace({ query: { tab: 'diagnostics', filter, color: 'source', search: 'keep' } })
    const target = session.artifactFiles.value.find(file => file.file === 'source-only/page.js')!
    const meta = moduleMeta(target, 'page')
    expect(session.filteredLargestFiles.value).not.toContain(target)

    const visitedQueries: unknown[] = []
    const stop = router.afterEach((to, _from, failure) => {
      if (!failure) {
        visitedQueries.push(to.query)
      }
    })
    await navigate(router, () => session.handleOpenInspectionSource(meta))
    stop()

    expect(visitedQueries).toEqual([{ tab: 'files', filter, color: 'source', search: 'keep' }])
    expect(router.currentRoute.value.query).toEqual(visitedQueries[0])
    expect(session.inspectionTarget.value).toEqual({ kind: 'module', packageId: target.packageId, file: target.file, moduleId: 'page' })
    expect(session.inspectionSourcePath.value).toBe('src/Page.vue')
    expect(session.filteredLargestFiles.value).not.toContain(target)
  })

  it.each(['package', 'missing-file', 'missing-module', 'node_modules', 'empty-source'] as const)('refuses %s source targets without changing the previous selection or route', async (kind) => {
    const { router, session } = await createHarness([sourcePackage])
    const target = session.artifactFiles.value.find(file => file.file === 'source-only/page.js')!
    const selectedMeta = moduleMeta(target, 'page')
    await navigate(router, () => session.handleOpenInspectionSource(selectedMeta))
    await router.replace({ query: { tab: 'diagnostics', filter: 'duplicates', color: 'source' } })
    const invalidTargets: Record<typeof kind, TreemapNodeMeta> = {
      'package': {
        kind: 'package',
        nodeId: createTreemapPackageNodeId(target.packageId),
        packageId: target.packageId,
        packageLabel: target.packageLabel,
        packageType: target.packageType,
        fileCount: sourcePackage.files.length,
      },
      'missing-file': { ...selectedMeta, fileName: 'missing.js' },
      'missing-module': { ...selectedMeta, nodeId: createTreemapModuleNodeId(target.packageId, target.file, 'missing') },
      'node_modules': {
        ...moduleMeta(session.artifactFiles.value.find(file => file.file === 'source-only/dependency.js')!, 'dependency'),
        sourceType: 'src',
        source: 'src/forged.ts',
      },
      'empty-source': { ...moduleMeta(target, 'unreadable'), source: 'src/forged.ts' },
    }
    const replace = vi.spyOn(router, 'replace')

    session.handleOpenInspectionSource(invalidTargets[kind])

    expect(replace).not.toHaveBeenCalled()
    expect(router.currentRoute.value.query).toEqual({ tab: 'diagnostics', filter: 'duplicates', color: 'source' })
    expect(session.inspectionTarget.value).toEqual({ kind: 'module', packageId: target.packageId, file: target.file, moduleId: 'page' })
    expect(session.inspectionSourcePath.value).toBe('src/Page.vue')
    replace.mockRestore()
  })

  it('keeps investigation context fixed when selection changes and ignores unknown targets', async () => {
    const { router, session } = await createHarness([sourcePackage])
    const target = { kind: 'artifact', packageId: 'source-only', file: 'source-only/page.js' } as const
    await navigate(router, () => session.handleCreateObjectInvestigation(target))
    const requestId = session.investigationRequestId.value
    session.handleSelectInspectionTarget({ kind: 'package', packageId: 'main' })
    expect(session.inspectionTarget.value).toEqual({ kind: 'package', packageId: 'main' })
    expect(session.investigationRequest.value).toEqual(target)
    session.handleCreateObjectInvestigation({ ...target, file: 'missing.js' })
    expect(session.investigationRequest.value).toEqual(target)
    expect(session.investigationRequestId.value).toBe(requestId)
  })

  it('permits inspecting a reported orphan placement without submitting an invalid investigation', async () => {
    const { session } = await createHarness([], [{
      id: 'orphan',
      source: 'src/orphan.ts',
      sourceType: 'src',
      packages: [{ packageId: 'main', files: ['missing.js'] }],
    }])
    const target = { kind: 'module', packageId: 'main', file: 'missing.js', moduleId: 'orphan' } as const
    session.handleSelectInspectionTarget(target)
    expect(session.inspectionTarget.value).toEqual(target)
    session.handleCreateObjectInvestigation(target)
    expect(session.investigationRequest.value).toBeNull()
    expect(session.investigationRequestId.value).toBe(0)
  })
})
