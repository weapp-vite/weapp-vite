import { computed, onMounted, ref } from 'vue'
import { useWorkbenchDebug } from '../lib/workbenchDebug'
import { builtInScenarios } from '../scenarios'
import { useWorkbenchFiles } from './useWorkbenchFiles'
import { useWorkbenchSession } from './useWorkbenchSession'
import { useWorkbenchTheme } from './useWorkbenchTheme'

export function useWorkbench() {
  const explorerTab = ref<'resources' | 'scenarios' | 'runtime'>('resources')
  const debugTab = ref<'wxml' | 'console' | 'appData' | 'sources' | 'network' | 'performance'>('console')
  const viewportSize = ref({ height: 812, width: 375 })

  const theme = useWorkbenchTheme()
  const sessionState = useWorkbenchSession(viewportSize)
  const files = useWorkbenchFiles(sessionState.fileEntries, sessionState.currentRoute)
  const debug = useWorkbenchDebug(
    sessionState.currentRoute,
    sessionState.pageStack,
    sessionState.previewMarkup,
    sessionState.requestLogData,
    sessionState.selectedScope,
    sessionState.storageData,
    viewportSize,
  )

  const projectDisplayLabel = computed(() => sessionState.projectLabel.value || 'weapp-vite-wevu-template')

  async function handleDirectoryChange(event: Event) {
    files.resetFiles()
    await sessionState.handleDirectoryChange(event)
  }

  function handlePickScenario(scenarioId: string) {
    files.resetFiles()
    sessionState.handlePickScenario(scenarioId)
  }

  onMounted(() => {
    const firstScenario = builtInScenarios[0]
    if (!sessionState.session.value && firstScenario) {
      files.resetFiles()
      sessionState.loadSession(firstScenario.name, firstScenario.files, firstScenario.id)
    }

    ;(window as any).__SIMULATOR_E2E__ = {
      getState: () => ({
        appData: sessionState.appData.value,
        currentRoute: sessionState.currentRoute.value,
        currentScenarioId: sessionState.currentScenarioId.value,
        pageData: sessionState.pageData.value,
        pageRoutes: sessionState.pageRoutes.value,
        pageStack: sessionState.pageStack.value,
        previewMarkup: sessionState.previewMarkup.value,
        requestLogData: sessionState.requestLogData.value,
        selectedScope: sessionState.selectedScope.value,
        storageData: sessionState.storageData.value,
        toastData: sessionState.toastData.value,
        viewportSize: viewportSize.value,
      }),
      findComponentScopeIds: (selector: string) => {
        return (sessionState.session.value?.selectAllComponents(selector) ?? [])
          .map(component => sessionState.session.value?.getScopeIdForComponent(component))
          .filter((scopeId): scopeId is string => Boolean(scopeId))
      },
      callComponentMethod: (scopeId: string, method: string, ...args: any[]) => {
        return sessionState.run(() => sessionState.session.value?.callScopeMethodDirect(scopeId, method, ...args))
      },
      dispatchTapChain: (payload: {
        activeScopeId: string
        chain: Array<{
          event: {
            currentTarget: { dataset: Record<string, string>, id: string }
            target: { dataset: Record<string, string>, id: string }
          }
          method: string
          scopeId: string
          stopAfter: boolean
        }>
      }) => sessionState.handleDispatchTapChain(payload),
      mockActionSheet: (definition: { cancel?: boolean, tapIndex?: number } = {}) => {
        sessionState.session.value?.mockActionSheet?.(definition)
      },
      mockModal: (definition: { cancel?: boolean, confirm?: boolean } = {}) => {
        sessionState.session.value?.mockModal?.(definition)
      },
      setNetworkType: (networkType: 'wifi' | '2g' | '3g' | '4g' | '5g' | 'none' | 'unknown') => {
        sessionState.session.value?.setNetworkType?.(networkType)
      },
      navigateBack: (delta = 1) => sessionState.run(() => sessionState.session.value?.navigateBack(delta)),
      openRoute: (route: string) => sessionState.handleOpenRoute(route),
      pickScenario: (scenarioId: string) => handlePickScenario(scenarioId),
      readScopeSnapshot: (scopeId: string) => sessionState.session.value?.getScopeSnapshot(scopeId) ?? null,
      renderCurrentPage: () => sessionState.session.value?.renderCurrentPage().wxml ?? '',
      runPageMethod: (method: string) => sessionState.handleCallMethod(method),
      sessionSnapshot: () => ({
        actionSheetLogs: sessionState.session.value?.getActionSheetLogs() ?? [],
        currentPageBackground: sessionState.session.value?.getCurrentPageBackground?.() ?? null,
        currentPageNavigationBar: sessionState.session.value?.getCurrentPageNavigationBar?.() ?? null,
        clipboardData: sessionState.session.value?.getClipboardData?.() ?? null,
        directorySnapshot: sessionState.session.value?.getDirectorySnapshot?.() ?? [],
        downloadFileLogs: sessionState.session.value?.getDownloadFileLogs?.() ?? [],
        fileSnapshot: sessionState.session.value?.getFileSnapshot?.() ?? {},
        loading: sessionState.session.value?.getLoading?.() ?? null,
        modalLogs: sessionState.session.value?.getModalLogs() ?? [],
        networkType: sessionState.session.value?.getNetworkType?.() ?? null,
        openedDocument: sessionState.session.value?.getOpenedDocument?.() ?? null,
        previewImage: sessionState.session.value?.getPreviewImage?.() ?? null,
        pullDownRefreshState: sessionState.session.value?.getPullDownRefreshState?.() ?? null,
        requestLogs: sessionState.session.value?.getRequestLogs() ?? [],
        savedFileList: sessionState.session.value?.getSavedFileListSnapshot?.() ?? [],
        shareMenu: sessionState.session.value?.getShareMenu() ?? null,
        storageSnapshot: sessionState.session.value?.getStorageSnapshot() ?? {},
        tabBarSnapshot: sessionState.session.value?.getTabBarSnapshot?.() ?? null,
        toast: sessionState.session.value?.getToast() ?? null,
        uploadFileLogs: sessionState.session.value?.getUploadFileLogs?.() ?? [],
      }),
      triggerPullDownRefresh: () => sessionState.run(() => sessionState.session.value?.triggerPullDownRefresh()),
      triggerReachBottom: () => sessionState.run(() => sessionState.session.value?.triggerReachBottom()),
      triggerResize: (width: number, height: number) => {
        viewportSize.value = { height, width }
        sessionState.run(() => sessionState.session.value?.triggerResize({
          size: {
            windowHeight: height,
            windowWidth: width,
          },
        }))
      },
      triggerRouteDone: (payload: Record<string, unknown> = { from: 'e2e' }) => sessionState.run(() => sessionState.session.value?.triggerRouteDone(payload)),
    }
  })

  return {
    ...debug,
    ...files,
    ...sessionState,
    ...theme,
    builtInScenarios,
    debugTab,
    explorerTab,
    handleDirectoryChange,
    handlePickScenario,
    projectDisplayLabel,
    viewportSize,
  }
}
