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
import JsonPanel from './components/JsonPanel.vue'
import RoutePanel from './components/RoutePanel.vue'
import ScenarioSelector from './components/ScenarioSelector.vue'
import ScopePanel from './components/ScopePanel.vue'
import SourceEditor from './components/SourceEditor.vue'
import StackPanel from './components/StackPanel.vue'
import { cn } from './lib/cn'
import { alertCard, chipWrapClass, labelClass, mutedTextClass, panelSurface, pill, tabButton, toolbarSurface } from './lib/ui'
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

const currentOptions = computed(() => {
  void revision.value
  return stringify(currentPage.value?.options ?? {})
})

const fileEntries = computed(() => {
  void revision.value
  return Array.from(session.value?.files.entries() ?? [])
    .map(([path, content]) => ({ content, path }))
    .sort((a, b) => a.path.localeCompare(b.path))
})

const fileMap = computed(() => new Map(fileEntries.value.map(entry => [entry.path, entry.content])))

const statusChips = computed(() => [
  { label: '路由', value: pageRoutes.value.length },
  { label: '栈', value: pageStack.value.length },
  { label: '当前页', value: currentRoute.value },
])

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
  selectedFilePath.value = path
  openFileTabs.value = [
    ...new Set([...openFileTabs.value, path]),
  ].slice(-6)

  const segments = path.split('/')
  expandedTreePaths.value = [
    ...new Set([
      ...expandedTreePaths.value,
      ...segments.slice(0, -1).map((_, index) => segments.slice(0, index + 1).join('/')),
    ]),
  ]
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
    <section class="grid h-full grid-rows-[38px_40px_minmax(0,1fr)] max-[1180px]:grid-rows-[38px_auto_minmax(0,1fr)]">
      <header class="flex items-center gap-3 border-b border-[color:var(--sim-divider)] bg-[color:var(--sim-toolbar-bg)] px-3 text-[12px]">
        <div class="flex items-center gap-1.5">
          <span class="h-3 w-3 rounded-full bg-[#ff5f57]" />
          <span class="h-3 w-3 rounded-full bg-[#febc2e]" />
          <span class="h-3 w-3 rounded-full bg-[#28c840]" />
        </div>
        <div class="mx-auto truncate text-[11px] font-medium text-[color:var(--sim-muted)]">
          {{ projectLabel }} - 微信开发者工具 · MPCore
        </div>
      </header>

      <section :class="cn(toolbarSurface(), 'border-b-0 px-3 py-1.5')">
        <div class="flex min-w-0 flex-1 items-center gap-2 overflow-hidden">
          <strong class="truncate text-[13px] font-semibold tracking-tight text-[color:var(--sim-text)]">MPCore DevTools</strong>
          <span :class="mutedTextClass">小程序模拟工作台</span>
        </div>
        <div :class="chipWrapClass" aria-label="当前会话状态">
          <span :class="cn(pill({ tone: 'subtle', interactive: false }), 'max-w-full')">
            <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sim-muted)]">项目</span>
            <strong class="truncate font-medium text-[color:var(--sim-text)]">{{ projectLabel }}</strong>
          </span>
          <span
            v-for="item in statusChips"
            :key="item.label"
            :class="cn(pill({ tone: 'subtle', interactive: false }), 'max-w-full')"
          >
            <span class="text-[10px] font-semibold uppercase tracking-[0.16em] text-[color:var(--sim-muted)]">
              {{ item.label }}
            </span>
            <strong class="truncate font-medium text-[color:var(--sim-text)]">{{ item.value }}</strong>
          </span>
        </div>

        <div class="flex flex-wrap items-center justify-start gap-2 xl:justify-end" role="group" aria-label="主题切换">
          <span :class="cn(labelClass, 'hidden xl:inline-flex')">Theme</span>
          <button
            v-for="option in themeOptions"
            :key="option.value"
            :class="pill({ tone: themeMode === option.value ? 'accent' : 'neutral' })"
            @click="setThemeMode(option.value)"
          >
            <span :class="cn(option.icon, 'text-sm')" aria-hidden="true" />
            {{ option.label }}
          </button>
          <span :class="cn(mutedTextClass, 'hidden xl:inline-flex')">当前：{{ effectiveTheme.toUpperCase() }}</span>
        </div>
      </section>

      <section v-if="errorMessage" :class="cn(alertCard(), 'absolute right-3 top-21 z-10 max-w-[520px] grid gap-1 rounded-md py-2')">
        <strong class="text-sm font-semibold">🕛 运行时错误</strong>
        <pre class="m-0 overflow-auto whitespace-pre-wrap text-xs leading-6">{{ errorMessage }}</pre>
      </section>

      <section class="grid min-h-0 [grid-template-columns:370px_250px_minmax(0,1fr)] max-[1180px]:grid-cols-1">
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
          <section :class="cn(tabPanelStyles.base(), 'h-full rounded-none border-0 shadow-none')">
            <div :class="tabPanelStyles.bar()" role="tablist" aria-label="资源区">
              <button
                v-for="tab in explorerTabs"
                :key="tab.value"
                :aria-selected="explorerTab === tab.value"
                :class="tabButton({ active: explorerTab === tab.value })"
                @click="explorerTab = tab.value"
              >
                <span :class="cn(tab.icon, 'text-sm')" aria-hidden="true" />
                {{ tab.label }}
              </button>
            </div>
            <div :class="tabPanelStyles.body()">
              <section
                v-if="explorerTab === 'resources'"
                class="grid min-h-0 grid-rows-[auto_minmax(0,1fr)] gap-3"
              >
                <div class="grid gap-2 rounded-[18px] border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] p-3">
                  <span :class="labelClass">资源管理器</span>
                  <div class="flex items-center justify-between gap-2">
                    <strong class="truncate text-sm text-[color:var(--sim-text)]">{{ projectLabel }}</strong>
                    <button :class="pill({ tone: 'neutral' })" @click="explorerTab = 'scenarios'">
                      <span class="icon-[mdi--swap-horizontal] text-sm" aria-hidden="true" />
                      切换场景
                    </button>
                  </div>
                </div>

                <div class="min-h-0 overflow-auto rounded-[18px] border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] p-2">
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

              <div v-else class="grid gap-3">
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

        <section class="grid min-h-0 [grid-template-rows:minmax(0,1fr)_270px] max-[1180px]:[grid-template-rows:minmax(420px,1fr)_minmax(280px,auto)]">
          <SourceEditor
            :code="selectedFileContent"
            :file-path="selectedFilePath"
            :lang="selectedFileLanguage"
            :open-files="openFileTabs"
            :project-label="projectLabel"
            :theme="effectiveTheme"
            @pick="openFile"
          />

          <section :class="cn(tabPanelStyles.base(), 'rounded-none border-x-0 border-b-0 shadow-none')">
            <div :class="tabPanelStyles.bar()" role="tablist" aria-label="调试区">
              <button
                v-for="tab in debugTabs"
                :key="tab.value"
                :aria-selected="debugTab === tab.value"
                :class="tabButton({ active: debugTab === tab.value })"
                @click="debugTab = tab.value"
              >
                <span :class="cn(tab.icon, 'text-sm')" aria-hidden="true" />
                {{ tab.label }}
              </button>
            </div>
            <div :class="tabPanelStyles.body()">
              <JsonPanel
                v-if="debugTab === 'wxml'"
                title="🕛 Wxml"
                subtitle="当前页面渲染输出后的结构快照。"
                :code="wxmlPreviewCode"
                lang="html"
                :theme="effectiveTheme"
              />

              <ScopePanel
                v-else-if="debugTab === 'console'"
                :scope-id="selectedScope?.scopeId ?? ''"
                :scope-type="selectedScope?.type ?? '未选中'"
                :methods="selectedScope?.methods ?? []"
                :properties-code="stringify(selectedScope?.properties ?? {})"
                :data-code="stringify(selectedScope?.data ?? {})"
                :theme="effectiveTheme"
              />

              <div v-else-if="debugTab === 'appData'" class="grid gap-3">
                <JsonPanel
                  title="🕛 页面数据"
                  subtitle="当前页面 data 快照。"
                  :code="pageData"
                  :theme="effectiveTheme"
                />
                <JsonPanel
                  title="🕛 页面参数"
                  subtitle="当前页面 options 快照。"
                  :code="currentOptions"
                  :theme="effectiveTheme"
                />
                <JsonPanel
                  title="🕛 应用数据"
                  subtitle="App.globalData。"
                  :code="appData"
                  :theme="effectiveTheme"
                />
              </div>

              <div v-else-if="debugTab === 'sources'" class="grid gap-3">
                <RoutePanel
                  :current-route="currentPage?.route ?? ''"
                  :routes="pageRoutes"
                  @open="handleOpenRoute"
                />
                <StackPanel :routes="pageStack" />
              </div>

              <div v-else-if="debugTab === 'network'" class="grid gap-3">
                <JsonPanel
                  title="🕛 Requests"
                  subtitle="request mock 命中日志。"
                  :code="requestLogData"
                  :theme="effectiveTheme"
                />
                <JsonPanel
                  title="🕛 Toast"
                  subtitle="showToast / hideToast 的宿主快照。"
                  :code="toastData"
                  :theme="effectiveTheme"
                />
                <JsonPanel
                  title="🕛 Storage"
                  subtitle="setStorageSync / getStorageSync 当前内存快照。"
                  :code="storageData"
                  :theme="effectiveTheme"
                />
              </div>

              <section v-else class="grid gap-3">
                <div class="grid gap-3 rounded-[20px] border border-[color:var(--sim-border)] bg-[color:var(--sim-panel)] p-4">
                  <div class="grid gap-1">
                    <h2 class="m-0 text-[17px] font-semibold tracking-tight text-[color:var(--sim-text)]">
                      🕛 性能与运行概览
                    </h2>
                    <p :class="labelClass">
                      以当前模拟会话和预览视口为基准。
                    </p>
                  </div>
                  <div class="grid gap-2 md:grid-cols-2">
                    <article
                      v-for="[label, value] in runtimeMetrics"
                      :key="label"
                      class="rounded-[18px] border border-[color:var(--sim-border)] bg-[color:var(--sim-pill-bg)] px-4 py-3"
                    >
                      <span :class="labelClass">{{ label }}</span>
                      <strong class="mt-2 block text-lg font-semibold text-[color:var(--sim-text)]">{{ value }}</strong>
                    </article>
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
