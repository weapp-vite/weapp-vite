<script setup lang="ts">
import type { BrowserDirectoryFileLike, BrowserHeadlessSession } from '../../../packages/simulator/src/browser'
import type { WorkbenchFileNode } from './types/workbench'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFilesFromDirectory,
} from '../../../packages/simulator/src/browser'
import ActionPanel from './components/ActionPanel.vue'
import DevicePreview from './components/DevicePreview.vue'
import FileTree from './components/FileTree.vue'
import HighlightedCode from './components/HighlightedCode.vue'
import RoutePanel from './components/RoutePanel.vue'
import ScenarioSelector from './components/ScenarioSelector.vue'
import SourceEditor from './components/SourceEditor.vue'
import StackPanel from './components/StackPanel.vue'
import { cn } from './lib/cn'
import { alertCard, labelClass, panelSurface, pill, tabButton, toolbarSurface } from './lib/ui'
import { builtInScenarios } from './scenarios'

const HOOK_NAMES = new Set([
  'onAddToFavorites',
  'onError',
  'onHide',
  'onLoad',
  'onPageScroll',
  'onPullDownRefresh',
  'onReachBottom',
  'onReady',
  'onResize',
  'onRouteDone',
  'onSaveExitState',
  'onShareAppMessage',
  'onShareTimeline',
  'onShow',
  'onTabItemTap',
  'onUnload',
  'setData',
])

const themeOptions = [
  { icon: 'icon-[mdi--theme-light-dark]', label: 'Auto', value: 'auto' },
  { icon: 'icon-[mdi--white-balance-sunny]', label: 'Light', value: 'light' },
  { icon: 'icon-[mdi--moon-waning-crescent]', label: 'Dark', value: 'dark' },
] as const

const explorerTabs = [
  { icon: 'icon-[mdi--folder-multiple-outline]', label: '资源管理器', value: 'resources' },
  { icon: 'icon-[mdi--flask-outline]', label: '场景', value: 'scenarios' },
  { icon: 'icon-[mdi--play-box-multiple-outline]', label: '运行区', value: 'runtime' },
] as const

const debugTabs = [
  { icon: 'icon-[mdi--language-html5]', label: 'Wxml', value: 'wxml' },
  { icon: 'icon-[mdi--console]', label: 'Console', value: 'console' },
  { icon: 'icon-[mdi--database-cog-outline]', label: 'AppData', value: 'appData' },
  { icon: 'icon-[mdi--folder-search-outline]', label: 'Sources', value: 'sources' },
  { icon: 'icon-[mdi--transit-connection-variant]', label: 'Network', value: 'network' },
  { icon: 'icon-[mdi--speedometer]', label: 'Performance', value: 'performance' },
] as const

interface SessionLike {
  getCurrentPages: () => Array<Record<string, any>>
}

type ThemeMode = 'auto' | 'light' | 'dark'

const THEME_STORAGE_KEY = 'mpcore-web-demo-theme'

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2)
}

function collectCallableMethods(session: SessionLike | null) {
  const page = session?.getCurrentPages().at(-1)
  if (!page) {
    return []
  }

  return Object.keys(page)
    .filter(key => typeof page[key] === 'function')
    .filter(key => !HOOK_NAMES.has(key))
    .filter(key => !key.startsWith('__'))
    .sort((a, b) => a.localeCompare(b))
}

const revision = ref(0)
const session = ref<BrowserHeadlessSession | null>(null)
const errorMessage = ref('')
const loading = ref(false)
const projectLabel = ref('未加载')
const currentScenarioId = ref('')
const selectedScopeId = ref('')
const explorerTab = ref<'resources' | 'scenarios' | 'runtime'>('resources')
const debugTab = ref<'wxml' | 'console' | 'appData' | 'sources' | 'network' | 'performance'>('console')
const selectedFilePath = ref('')
const openFileTabs = ref<string[]>([])
const expandedTreePaths = ref<string[]>([])
const themeMode = ref<ThemeMode>('auto')
const systemPrefersDark = ref(false)
const viewportSize = ref({ height: 812, width: 375 })
let colorSchemeQuery: MediaQueryList | null = null
let handleColorSchemeChange: ((event: MediaQueryListEvent) => void) | null = null

const tabPanelStyles = panelSurface()

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

const fileMap = computed(() => new Map(fileEntries.value.map(entry => [entry.path, entry.content])))

const routeSourceCandidates = computed(() => {
  const route = currentRoute.value === '未加载页面' ? '' : currentRoute.value
  if (!route) {
    return []
  }
  return [
    `${route}.js`,
    `${route}.wxml`,
    `${route}.json`,
    `${route}.wxss`,
  ]
})

const selectedFileContent = computed(() => fileMap.value.get(selectedFilePath.value) ?? '')

const selectedFileLanguage = computed(() => {
  const extension = selectedFilePath.value.split('.').pop()?.toLowerCase()
  switch (extension) {
    case 'js':
    case 'ts':
      return 'javascript'
    case 'json':
      return 'json'
    case 'wxml':
    case 'html':
      return 'html'
    case 'wxss':
    case 'css':
      return 'css'
    case 'xml':
      return 'xml'
    default:
      return 'javascript'
  }
})

const runtimeMetrics = computed(() => [
  ['视口', `${viewportSize.value.width} × ${viewportSize.value.height}`],
  ['页面栈', String(pageStack.value.length)],
  ['请求数', String(JSON.parse(requestLogData.value).length || 0)],
  ['Storage Keys', String(Object.keys(JSON.parse(storageData.value)).length)],
])

const wxmlPreviewCode = computed(() => previewMarkup.value || '<page />')
const projectDisplayLabel = computed(() => projectLabel.value || 'weapp-vite-wevu-template')
const consoleSummary = computed(() => [
  { level: 'messages', value: '9 messages' },
  { level: 'warnings', value: '3 warnings' },
  { level: 'errors', value: 'No errors' },
])
const explorerToolbarIcons = [
  'icon-[mdi--file-outline]',
  'icon-[mdi--folder-outline]',
  'icon-[mdi--magnify]',
  'icon-[mdi--source-branch]',
  'icon-[mdi--content-save-outline]',
  'icon-[mdi--apple-keyboard-command]',
]
const workbenchToolbarIcons = [
  'icon-[mdi--play-outline]',
  'icon-[mdi--cellphone]',
  'icon-[mdi--refresh]',
  'icon-[mdi--qrcode-scan]',
  'icon-[mdi--dots-horizontal]',
]

function buildTreeNodes(paths: string[], depth = 0, prefix = ''): WorkbenchFileNode[] {
  const directories = new Map<string, string[]>()
  const files: WorkbenchFileNode[] = []

  for (const rawPath of paths) {
    const relativePath = prefix ? rawPath.slice(prefix.length + 1) : rawPath
    if (!relativePath) {
      continue
    }
    const [segment, ...rest] = relativePath.split('/')
    if (!segment) {
      continue
    }
    if (rest.length === 0) {
      files.push({
        depth,
        name: segment,
        path: prefix ? `${prefix}/${segment}` : segment,
        type: 'file',
      })
      continue
    }
    const bucket = directories.get(segment) ?? []
    bucket.push(prefix ? `${prefix}/${segment}/${rest.join('/')}` : `${segment}/${rest.join('/')}`)
    directories.set(segment, bucket)
  }

  const directoryNodes = Array.from(directories.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([name, children]) => {
      const path = prefix ? `${prefix}/${name}` : name
      return {
        children: buildTreeNodes(children, depth + 1, path),
        depth,
        name,
        path,
        type: 'directory' as const,
      }
    })

  return [
    ...directoryNodes,
    ...files.sort((a, b) => a.name.localeCompare(b.name)),
  ]
}

const fileTree = computed(() => buildTreeNodes(fileEntries.value.map(entry => entry.path)))

const selectedScope = computed(() => {
  void revision.value
  if (!session.value || !selectedScopeId.value) {
    return null
  }
  return session.value.getScopeSnapshot(selectedScopeId.value)
})

const consoleLines = computed(() => {
  const requestLogs = JSON.parse(requestLogData.value) as Array<Record<string, unknown>>
  const storage = JSON.parse(storageData.value) as Record<string, unknown>
  const route = currentRoute.value

  return [
    { level: 'system', text: `[system] Launch Time: ${Math.round(460 + previewMarkup.value.length / 8)}ms` },
    { level: 'warn', text: '[Deprecation] SharedArrayBuffer 将要求 cross-origin isolation。' },
    { level: 'info', text: `[system] Current route: /${route}` },
    { level: 'info', text: `[system] Storage keys: ${Object.keys(storage).length}` },
    { level: 'info', text: `[system] Mock requests: ${requestLogs.length}` },
    { level: 'debug', text: `[render] Scope selected: ${selectedScope.value?.scopeId ?? 'page-root'}` },
  ]
})

const effectiveTheme = computed<'light' | 'dark'>(() => {
  if (themeMode.value === 'auto') {
    return systemPrefersDark.value ? 'dark' : 'light'
  }
  return themeMode.value
})

function touch() {
  revision.value += 1
}

function applyTheme(theme: 'light' | 'dark') {
  document.documentElement.dataset.simTheme = theme
}

function setThemeMode(mode: ThemeMode) {
  themeMode.value = mode
  if (mode === 'auto') {
    localStorage.removeItem(THEME_STORAGE_KEY)
    return
  }
  localStorage.setItem(THEME_STORAGE_KEY, mode)
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
  openFileTabs.value = []
  expandedTreePaths.value = []
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

const firstScenario = builtInScenarios[0]
if (!session.value && firstScenario) {
  loadSession(firstScenario.name, firstScenario.files, firstScenario.id)
}

onMounted(() => {
  const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)')
  const updateSystemTheme = (event?: MediaQueryList | MediaQueryListEvent) => {
    systemPrefersDark.value = event?.matches ?? mediaQuery.matches
  }

  const storedTheme = localStorage.getItem(THEME_STORAGE_KEY)
  if (storedTheme === 'light' || storedTheme === 'dark') {
    themeMode.value = storedTheme
  }
  else {
    themeMode.value = 'auto'
  }

  updateSystemTheme(mediaQuery)
  handleColorSchemeChange = event => updateSystemTheme(event)
  mediaQuery.addEventListener('change', handleColorSchemeChange)
  colorSchemeQuery = mediaQuery
})

onBeforeUnmount(() => {
  if (colorSchemeQuery && handleColorSchemeChange) {
    colorSchemeQuery.removeEventListener('change', handleColorSchemeChange)
  }
})

watch(effectiveTheme, (theme) => {
  applyTheme(theme)
}, {
  immediate: true,
})

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
  selectedScopeId.value = scopeId
  touch()
}

function handleUpdateViewport(payload: { height: number, width: number }) {
  viewportSize.value = payload
  run(() => session.value?.triggerResize({
    size: {
      windowHeight: payload.height,
      windowWidth: payload.width,
    },
  }))
}

function openFile(path: string) {
  if (!fileMap.value.has(path)) {
    return
  }
  const segments = path.split('/')
  const nextExpandedTreePaths = [
    ...new Set([
      ...expandedTreePaths.value,
      ...segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/')),
    ]),
  ]
  const nextOpenTabs = [
    ...new Set([...openFileTabs.value, path]),
  ].slice(-6)

  if (
    selectedFilePath.value === path
    && nextOpenTabs.length === openFileTabs.value.length
    && nextOpenTabs.every((item, index) => item === openFileTabs.value[index])
    && nextExpandedTreePaths.length === expandedTreePaths.value.length
    && nextExpandedTreePaths.every((item, index) => item === expandedTreePaths.value[index])
  ) {
    return
  }

  selectedFilePath.value = path
  openFileTabs.value = nextOpenTabs
  expandedTreePaths.value = nextExpandedTreePaths
}

function toggleTreePath(path: string) {
  expandedTreePaths.value = expandedTreePaths.value.includes(path)
    ? expandedTreePaths.value.filter(item => item !== path)
    : [...expandedTreePaths.value, path]
}

watch(fileEntries, (entries) => {
  if (entries.length === 0) {
    selectedFilePath.value = ''
    openFileTabs.value = []
    expandedTreePaths.value = []
    return
  }

  if (expandedTreePaths.value.length === 0) {
    const roots = entries
      .map(entry => entry.path.split('/')[0])
      .filter((value, index, array) => array.indexOf(value) === index)
    expandedTreePaths.value = roots
  }

  const candidate = routeSourceCandidates.value.find(path => fileMap.value.has(path))
    ?? ['app.json', 'app.js', entries[0]?.path].find(path => path && fileMap.value.has(path))

  if (!selectedFilePath.value || !fileMap.value.has(selectedFilePath.value)) {
    openFile(candidate ?? entries[0].path)
    return
  }

  if (candidate && !openFileTabs.value.includes(candidate)) {
    openFileTabs.value = [...new Set([candidate, ...openFileTabs.value])].slice(0, 6)
  }
}, { immediate: true })

watch(currentRoute, () => {
  const candidate = routeSourceCandidates.value.find(path => fileMap.value.has(path))
  if (candidate) {
    openFile(candidate)
  }
})
</script>

<template>
  <main class="h-screen overflow-hidden bg-[color:var(--sim-bg)] text-[color:var(--sim-text)]">
    <section class="grid h-full grid-rows-[28px_34px_minmax(0,1fr)] overflow-hidden max-[1180px]:grid-rows-[28px_auto_minmax(0,1fr)]">
      <header class="grid grid-cols-[140px_minmax(0,1fr)_320px] items-center gap-3 border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-toolbar-bg)] px-3 text-[11px] max-[1180px]:grid-cols-[140px_minmax(0,1fr)]">
        <div class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span class="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span class="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div class="truncate text-center text-[11px] font-medium text-[color:var(--sim-muted)]">
          {{ projectDisplayLabel }} - 微信开发者工具 Stable 0.1.2510280
        </div>
        <div class="flex items-center justify-end gap-3 text-[10px] text-[color:var(--sim-muted)] max-[1180px]:hidden">
          <span class="truncate">小程序模式</span>
          <span class="inline-flex items-center gap-1">
            <span class="icon-[mdi--eye-outline] text-[12px]" aria-hidden="true" />
            预览
          </span>
          <span>真机调试</span>
          <span class="icon-[mdi--upload-outline] text-[12px]" aria-hidden="true" />
          <span class="icon-[mdi--content-save-outline] text-[12px]" aria-hidden="true" />
          <span class="inline-flex h-5 w-5 items-center justify-center rounded-sm border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)]">
            <span class="icon-[mdi--account] text-[12px]" aria-hidden="true" />
          </span>
        </div>
      </header>

      <section :class="cn(toolbarSurface(), 'border-b border-[color:var(--sim-divider)] px-3 py-0')">
        <div class="flex min-w-0 items-center gap-3 overflow-hidden">
          <button class="inline-flex h-7 w-7 items-center justify-center rounded-sm text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]">
            <span class="icon-[mdi--chevron-left]" aria-hidden="true" />
          </button>
          <button class="inline-flex h-7 w-7 items-center justify-center rounded-sm text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]">
            <span class="icon-[mdi--reload]" aria-hidden="true" />
          </button>
          <div class="flex min-w-0 items-center gap-2 rounded-sm border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] px-2.5 py-1">
            <span class="icon-[mdi--folder-open-outline] text-[13px] text-[#8bc34a]" aria-hidden="true" />
            <span class="truncate text-[11px] text-[color:var(--sim-text)]">{{ currentRoute }}</span>
          </div>
        </div>

        <div class="flex items-center gap-1 text-[color:var(--sim-muted)]">
          <button
            v-for="icon in workbenchToolbarIcons"
            :key="icon"
            class="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-[color:var(--sim-pill-hover)]"
          >
            <span :class="cn(icon, 'text-[14px]')" aria-hidden="true" />
          </button>
        </div>

        <div class="flex items-center justify-end gap-2" role="group" aria-label="主题切换">
          <span :class="cn(labelClass, 'hidden 2xl:inline-flex')">Theme</span>
          <button
            v-for="option in themeOptions"
            :key="option.value"
            :class="cn(pill({ tone: themeMode === option.value ? 'accent' : 'neutral' }), 'h-7 rounded-sm px-2.5 py-0 text-[11px]')"
            @click="setThemeMode(option.value)"
          >
            <span :class="cn(option.icon, 'text-[13px]')" aria-hidden="true" />
            {{ option.label }}
          </button>
        </div>
      </section>

      <section v-if="errorMessage" :class="cn(alertCard(), 'absolute right-3 top-18 z-10 max-w-[520px] grid gap-1 rounded-md py-2')">
        <strong class="text-sm font-semibold">🕛 运行时错误</strong>
        <pre class="m-0 overflow-auto whitespace-pre-wrap text-xs leading-6">{{ errorMessage }}</pre>
      </section>

      <section class="grid min-h-0 [grid-template-columns:428px_378px_minmax(0,1fr)] overflow-hidden max-[1180px]:grid-cols-1">
        <aside class="min-h-0 border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-soft)]">
          <DevicePreview
            :route="currentRoute"
            :markup="previewMarkup"
            :viewport-height="viewportSize.height"
            :viewport-width="viewportSize.width"
            @back="run(() => session?.navigateBack())"
            @dispatch-tap-chain="handleDispatchTapChain"
            @select-scope="handleSelectScope"
            @update-viewport="handleUpdateViewport"
          />
        </aside>

        <section class="min-h-0 border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-soft)]">
          <section :class="cn(tabPanelStyles.base(), 'h-full rounded-none border-0 shadow-none [grid-template-rows:32px_32px_minmax(0,1fr)]')">
            <div class="flex items-center justify-between border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel-strong)] px-2">
              <div class="flex items-center gap-0.5 text-[color:var(--sim-muted)]">
                <button
                  v-for="icon in explorerToolbarIcons"
                  :key="icon"
                  class="inline-flex h-7 w-7 items-center justify-center rounded-sm hover:bg-[color:var(--sim-pill-hover)]"
                >
                  <span :class="cn(icon, 'text-[14px]')" aria-hidden="true" />
                </button>
              </div>
              <button class="inline-flex h-7 w-7 items-center justify-center rounded-sm text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]">
                <span class="icon-[mdi--dots-horizontal]" aria-hidden="true" />
              </button>
            </div>
            <div :class="cn(tabPanelStyles.bar(), 'px-0')" role="tablist" aria-label="资源区">
              <button
                v-for="tab in explorerTabs"
                :key="tab.value"
                :aria-selected="explorerTab === tab.value"
                :class="cn(tabButton({ active: explorerTab === tab.value }), 'px-3 py-1.5 text-[11px]')"
                @click="explorerTab = tab.value"
              >
                <span :class="cn(tab.icon, 'text-[13px]')" aria-hidden="true" />
                {{ tab.label }}
              </button>
            </div>
            <div :class="cn(tabPanelStyles.body(), 'min-h-0 gap-0 p-0')">
              <section
                v-if="explorerTab === 'resources'"
                class="grid h-full min-h-0 grid-rows-[30px_minmax(0,1fr)]"
              >
                <div class="flex items-center border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3 text-[11px]">
                  <span class="truncate font-semibold uppercase tracking-[0.08em] text-[color:var(--sim-muted)]">{{ projectDisplayLabel }}</span>
                </div>
                <div class="min-h-0 overflow-auto bg-[color:var(--sim-panel)] p-2">
                  <FileTree
                    :expanded-paths="expandedTreePaths"
                    :nodes="fileTree"
                    :selected-path="selectedFilePath"
                    @select="openFile"
                    @toggle="toggleTreePath"
                  />
                </div>
              </section>

              <ScenarioSelector
                v-else-if="explorerTab === 'scenarios'"
                :active-id="currentScenarioId"
                :loading="loading"
                :scenarios="builtInScenarios"
                @pick="handlePickScenario"
                @pick-directory="handleDirectoryChange"
              />

              <div v-else class="grid gap-2 p-2">
                <RoutePanel
                  :current-route="currentPage?.route ?? ''"
                  :routes="pageRoutes"
                  @open="handleOpenRoute"
                />
                <ActionPanel
                  :methods="callableMethods"
                  @call-method="handleCallMethod"
                  @page-scroll="run(() => session?.pageScrollTo({ scrollTop: 128 }))"
                  @pull-refresh="run(() => session?.triggerPullDownRefresh())"
                  @reach-bottom="run(() => session?.triggerReachBottom())"
                  @route-done="run(() => session?.triggerRouteDone({ from: 'web-demo' }))"
                  @resize="run(() => session?.triggerResize({ size: { windowWidth: viewportSize.width, windowHeight: viewportSize.height } }))"
                />
                <StackPanel :routes="pageStack" />
              </div>
            </div>
          </section>
        </section>

        <section class="grid min-h-0 [grid-template-rows:minmax(0,1fr)_392px] max-[1180px]:[grid-template-rows:minmax(420px,1fr)_minmax(280px,auto)]">
          <SourceEditor
            :code="selectedFileContent"
            :file-path="selectedFilePath"
            :lang="selectedFileLanguage"
            :open-files="openFileTabs"
            :project-label="projectLabel"
            :theme="effectiveTheme"
            @pick="openFile"
          />

          <section :class="cn(tabPanelStyles.base(), 'rounded-none border-x-0 border-b-0 shadow-none [grid-template-rows:32px_minmax(0,1fr)]')">
            <div :class="cn(tabPanelStyles.bar(), 'px-0')" role="tablist" aria-label="调试区">
              <button
                v-for="tab in debugTabs"
                :key="tab.value"
                :aria-selected="debugTab === tab.value"
                :class="cn(tabButton({ active: debugTab === tab.value }), 'px-3 py-1.5 text-[11px]')"
                @click="debugTab = tab.value"
              >
                <span :class="cn(tab.icon, 'text-[13px]')" aria-hidden="true" />
                {{ tab.label }}
              </button>
              <div class="ml-auto flex items-center gap-2 px-3 text-[color:var(--sim-muted)]">
                <span class="text-[11px]">⚠ 3</span>
                <button class="inline-flex h-6 w-6 items-center justify-center rounded-sm hover:bg-[color:var(--sim-pill-hover)]">
                  <span class="icon-[mdi--cog-outline] text-[13px]" aria-hidden="true" />
                </button>
              </div>
            </div>
            <div :class="cn(tabPanelStyles.body(), 'grid grid-rows-[minmax(0,1fr)_154px] gap-0 p-0')">
              <section class="grid min-h-0 grid-cols-[minmax(0,1fr)_318px] border-b border-[color:var(--sim-divider)]">
                <div class="grid min-h-0 grid-rows-[28px_minmax(0,1fr)]">
                  <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3 text-[11px] text-[color:var(--sim-muted)]">
                    <span>{{ currentRoute }}</span>
                    <span class="text-[color:var(--sim-text)]">#shadow-root</span>
                    <span class="text-[#5aa0ff]">&lt;/{{ currentRoute.split('/').at(-1) || 'page' }}&gt;</span>
                  </div>
                  <div class="min-h-0 overflow-hidden p-2">
                    <HighlightedCode
                      v-if="debugTab === 'wxml'"
                      :code="wxmlPreviewCode"
                      lang="html"
                      :theme="effectiveTheme"
                    />
                    <HighlightedCode
                      v-else-if="debugTab === 'appData'"
                      :code="appData"
                      lang="json"
                      :theme="effectiveTheme"
                    />
                    <HighlightedCode
                      v-else-if="debugTab === 'sources'"
                      :code="selectedFileContent"
                      :lang="selectedFileLanguage"
                      :theme="effectiveTheme"
                    />
                    <HighlightedCode
                      v-else-if="debugTab === 'network'"
                      :code="requestLogData"
                      lang="json"
                      :theme="effectiveTheme"
                    />
                    <div v-else-if="debugTab === 'performance'" class="grid h-full content-start gap-2 p-2">
                      <article
                        v-for="[label, value] in runtimeMetrics"
                        :key="label"
                        class="grid gap-1 border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] px-3 py-2"
                      >
                        <span class="text-[10px] uppercase tracking-[0.14em] text-[color:var(--sim-muted)]">{{ label }}</span>
                        <strong class="text-[18px] leading-none text-[color:var(--sim-text)]">{{ value }}</strong>
                      </article>
                    </div>
                    <HighlightedCode
                      v-else
                      :code="selectedScope?.data ? stringify(selectedScope.data) : pageData"
                      lang="json"
                      :theme="effectiveTheme"
                    />
                  </div>
                </div>

                <aside class="grid min-h-0 grid-rows-[28px_28px_minmax(0,1fr)] border-l border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)]">
                  <div class="flex items-center gap-0.5 border-b border-[color:var(--sim-divider)] px-1 text-[11px]">
                    <button class="inline-flex h-7 items-center border-r border-[color:var(--sim-divider)] px-3 text-[color:var(--sim-text)]">
                      Styles
                    </button>
                    <button class="inline-flex h-7 items-center border-r border-[color:var(--sim-divider)] px-3 text-[color:var(--sim-muted)]">
                      Computed
                    </button>
                    <button class="inline-flex h-7 items-center border-r border-[color:var(--sim-divider)] px-3 text-[color:var(--sim-muted)]">
                      Dataset
                    </button>
                    <button class="inline-flex h-7 items-center px-3 text-[color:var(--sim-muted)]">
                      Component Data
                    </button>
                  </div>
                  <div class="flex items-center justify-between border-b border-[color:var(--sim-divider)] px-3 text-[11px] text-[color:var(--sim-muted)]">
                    <span>Filter</span>
                    <span>.cls</span>
                  </div>
                  <div class="min-h-0 overflow-auto px-3 py-2 text-[11px] leading-5 text-[color:var(--sim-muted)]">
                    <div class="border-b border-[color:var(--sim-divider)] pb-2">
                      <div class="font-semibold text-[color:var(--sim-text)]">
                        {{ selectedScope?.scopeType ?? selectedScope?.type ?? 'page' }}
                      </div>
                      <div>{{ selectedScope?.scopeId ?? 'page-root' }}</div>
                    </div>
                    <div class="grid gap-1 py-2">
                      <div class="flex items-start justify-between gap-3">
                        <span>route</span>
                        <span class="text-[color:var(--sim-text)]">{{ currentRoute }}</span>
                      </div>
                      <div class="flex items-start justify-between gap-3">
                        <span>methods</span>
                        <span class="text-[color:var(--sim-text)]">{{ selectedScope?.methods?.length ?? callableMethods.length }}</span>
                      </div>
                      <div class="flex items-start justify-between gap-3">
                        <span>toast</span>
                        <span class="truncate text-[color:var(--sim-text)]">{{ JSON.parse(toastData) ? 'visible' : 'idle' }}</span>
                      </div>
                    </div>
                  </div>
                </aside>
              </section>

              <section class="grid min-h-0 grid-cols-[168px_minmax(0,1fr)] bg-[color:var(--sim-panel-soft)]">
                <aside class="border-r border-[color:var(--sim-divider)] bg-[color:var(--sim-panel)] px-3 py-2">
                  <div class="grid gap-1 text-[11px]">
                    <button class="flex items-center justify-between rounded-sm px-2 py-1 text-left text-[color:var(--sim-text)] hover:bg-[color:var(--sim-pill-hover)]">
                      <span>Console</span>
                      <span class="text-[color:var(--sim-muted)]">1</span>
                    </button>
                    <button class="flex items-center justify-between rounded-sm px-2 py-1 text-left text-[color:var(--sim-muted)] hover:bg-[color:var(--sim-pill-hover)]">
                      <span>Task</span>
                      <span>0</span>
                    </button>
                  </div>
                  <div class="mt-3 grid gap-1 text-[11px] text-[color:var(--sim-muted)]">
                    <div
                      v-for="item in consoleSummary"
                      :key="item.level"
                      class="flex items-center justify-between rounded-sm px-2 py-1"
                    >
                      <span>{{ item.level }}</span>
                      <span>{{ item.value }}</span>
                    </div>
                  </div>
                </aside>

                <div class="grid min-h-0 grid-rows-[26px_minmax(0,1fr)]">
                  <div class="flex items-center gap-2 border-b border-[color:var(--sim-divider)] px-3 text-[11px] text-[color:var(--sim-muted)]">
                    <span class="icon-[mdi--funnel-outline] text-[12px]" aria-hidden="true" />
                    <span>Filter</span>
                    <span class="ml-auto">Default levels</span>
                  </div>
                  <div class="min-h-0 overflow-auto text-[11px] leading-5">
                    <div
                      v-for="(line, index) in consoleLines"
                      :key="`${line.level}-${index}`"
                      :class="cn(
                        'flex items-center gap-2 border-b border-[color:var(--sim-divider)] px-3 py-1.5',
                        line.level === 'warn' && 'bg-[color:var(--sim-warn-bg)] text-[color:var(--sim-warn-text)]',
                        line.level === 'system' && 'text-[color:var(--sim-text)]',
                      )"
                    >
                      <span
                        :class="cn(
                          'inline-flex h-4 w-4 shrink-0 items-center justify-center rounded-full text-[9px] font-semibold uppercase',
                          line.level === 'warn' ? 'bg-[#d7a51d] text-[#1f1600]' : 'bg-[color:var(--sim-pill-bg)] text-[color:var(--sim-muted)]',
                        )"
                      >
                        {{ line.level[0] }}
                      </span>
                      <span class="truncate">{{ line.text }}</span>
                    </div>
                  </div>
                </div>
              </section>
            </div>
          </section>
        </section>
      </section>
    </section>
  </main>
</template>
