import type { Ref } from 'vue'
import type { BrowserDirectoryFileLike, BrowserHeadlessSession } from '../../../../packages/simulator/src/browser'
import { computed, ref, shallowRef } from 'vue'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFilesFromDirectory,
} from '../../../../packages/simulator/src/browser'
import { collectCallableMethods, stringify } from '../lib/workbench'
import { builtInScenarios } from '../scenarios'

export function useWorkbenchSession(viewportSize: Ref<{ height: number, width: number }>) {
  const revision = ref(0)
  const session = shallowRef<BrowserHeadlessSession | null>(null)
  const errorMessage = ref('')
  const loading = ref(false)
  const projectLabel = ref('未加载')
  const currentScenarioId = ref('')
  const selectedScopeId = ref('')

  const currentPage = computed(() => {
    void revision.value
    return session.value?.getCurrentPages().at(-1) ?? null
  })

  const currentRoute = computed(() => currentPage.value?.route ?? '未加载页面')
  const pageRoutes = computed(() => {
    void revision.value
    return session.value?.project.routes.map(route => route.route) ?? []
  })
  const pageStack = computed(() => {
    void revision.value
    return session.value?.getCurrentPages().map(page => page.route) ?? []
  })
  const callableMethods = computed(() => {
    void revision.value
    return collectCallableMethods(session.value)
  })
  const previewMarkup = computed(() => {
    void revision.value
    if (!session.value || !currentPage.value) {
      return ''
    }

    try {
      return session.value.renderCurrentPage().wxml
    }
    catch (error) {
      return `<page><view class="sim-preview-error">${String((error as Error).message ?? error)}</view></page>`
    }
  })
  const pageData = computed(() => {
    void revision.value
    return stringify(currentPage.value?.data ?? {})
  })
  const appData = computed(() => {
    void revision.value
    return stringify(session.value?.getApp()?.globalData ?? {})
  })
  const toastData = computed(() => {
    void revision.value
    return stringify(session.value?.getToast() ?? null)
  })
  const storageData = computed(() => {
    void revision.value
    return stringify(session.value?.getStorageSnapshot() ?? {})
  })
  const requestLogData = computed(() => {
    void revision.value
    return stringify(session.value?.getRequestLogs() ?? [])
  })
  const fileEntries = computed(() => {
    void revision.value
    return Array.from(session.value?.files.entries() ?? [])
      .map(([path, content]) => ({ content, path }))
      .sort((a, b) => a.path.localeCompare(b.path))
  })
  const selectedScope = computed(() => {
    void revision.value
    if (!session.value || !selectedScopeId.value) {
      return null
    }
    return session.value.getScopeSnapshot(selectedScopeId.value)
  })

  function touch() {
    revision.value += 1
  }

  function primeSession(nextSession: BrowserHeadlessSession) {
    nextSession.mockRequest({
      method: 'GET',
      response: {
        count: 7,
        queue: 'alpha',
        status: 'stable',
      },
      url: 'https://mock.mpcore.dev/api/queue-health',
    })
  }

  function loadSession(label: string, files: BrowserHeadlessSession['files'], scenarioId?: string) {
    const nextSession = createBrowserHeadlessSession({ files })
    primeSession(nextSession)
    session.value = nextSession
    currentScenarioId.value = scenarioId ?? ''
    projectLabel.value = label
    const firstRoute = nextSession.project.routes[0]?.route
    if (firstRoute) {
      nextSession.reLaunch(`/${firstRoute}`)
      nextSession.triggerResize({
        size: {
          windowHeight: viewportSize.value.height,
          windowWidth: viewportSize.value.width,
        },
      })
      selectedScopeId.value = `page:${firstRoute}`
    }
    touch()
  }

  function run(action: () => void) {
    try {
      errorMessage.value = ''
      action()
    }
    catch (error) {
      errorMessage.value = String((error as Error).message ?? error)
    }
    finally {
      touch()
    }
  }

  async function handleDirectoryChange(event: Event) {
    const input = event.target as HTMLInputElement
    const files = Array.from(input.files ?? []) as BrowserDirectoryFileLike[]
    if (files.length === 0) {
      return
    }

    loading.value = true
    errorMessage.value = ''
    try {
      const virtualFiles = await createBrowserVirtualFilesFromDirectory(files)
      loadSession(files[0]?.webkitRelativePath?.split('/')[0] ?? '已导入目录', virtualFiles)
    }
    catch (error) {
      session.value = null
      errorMessage.value = String((error as Error).message ?? error)
    }
    finally {
      loading.value = false
      touch()
    }
  }

  function handlePickScenario(scenarioId: string) {
    run(() => {
      const scenario = builtInScenarios.find(item => item.id === scenarioId)
      if (scenario) {
        loadSession(scenario.name, scenario.files, scenario.id)
      }
    })
  }

  function handleOpenRoute(route: string) {
    run(() => session.value?.reLaunch(`/${route}`))
  }

  function handleCallMethod(method: string) {
    run(() => {
      const page = session.value?.getCurrentPages().at(-1)
      page?.[method]?.()
    })
  }

  function handleDispatchTapChain(payload: {
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
  }) {
    run(() => {
      selectedScopeId.value = payload.activeScopeId
      for (const invocation of payload.chain) {
        session.value?.callTapBindingWithEvent(invocation.scopeId, invocation.method, invocation.event)
        if (invocation.stopAfter) {
          break
        }
      }
    })
  }

  function handleSelectScope(scopeId: string) {
    if (selectedScopeId.value === scopeId) {
      return
    }
    selectedScopeId.value = scopeId
    touch()
  }

  function handleUpdateViewport(payload: { height: number, width: number }) {
    if (viewportSize.value.width === payload.width && viewportSize.value.height === payload.height) {
      return
    }
    viewportSize.value = payload
    run(() => session.value?.triggerResize({
      size: {
        windowHeight: payload.height,
        windowWidth: payload.width,
      },
    }))
  }

  return {
    appData,
    callableMethods,
    currentPage,
    currentRoute,
    currentScenarioId,
    errorMessage,
    fileEntries,
    handleCallMethod,
    handleDirectoryChange,
    handleDispatchTapChain,
    handleOpenRoute,
    handlePickScenario,
    handleSelectScope,
    handleUpdateViewport,
    loadSession,
    loading,
    pageData,
    pageRoutes,
    pageStack,
    previewMarkup,
    projectLabel,
    requestLogData,
    run,
    selectedScope,
    session,
    storageData,
    toastData,
  }
}
