<script setup lang="ts">
import type { BrowserDirectoryFileLike, BrowserHeadlessSession } from '../../../packages/simulator/src/browser'
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFilesFromDirectory,
} from '../../../packages/simulator/src/browser'
import ActionPanel from './components/ActionPanel.vue'
import DevicePreview from './components/DevicePreview.vue'
import JsonPanel from './components/JsonPanel.vue'
import RoutePanel from './components/RoutePanel.vue'
import ScenarioSelector from './components/ScenarioSelector.vue'
import ScopePanel from './components/ScopePanel.vue'
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

const primaryTabs = [
  { icon: 'icon-[mdi--view-grid-outline]', label: '场景', value: 'scenario' },
  { icon: 'icon-[mdi--routes]', label: '路由', value: 'routes' },
  { icon: 'icon-[mdi--gesture-tap-button]', label: '操作', value: 'actions' },
  { icon: 'icon-[mdi--layers-triple-outline]', label: '页面栈', value: 'stack' },
] as const

const inspectorTabs = [
  { icon: 'icon-[mdi--layers-outline]', label: 'Scope', value: 'scope' },
  { icon: 'icon-[mdi--tune-variant]', label: 'Options', value: 'options' },
  { icon: 'icon-[mdi--database-outline]', label: 'Page Data', value: 'page' },
  { icon: 'icon-[mdi--database-cog-outline]', label: 'App Data', value: 'app' },
  { icon: 'icon-[mdi--message-badge-outline]', label: 'Toast', value: 'toast' },
  { icon: 'icon-[mdi--content-save-outline]', label: 'Storage', value: 'storage' },
  { icon: 'icon-[mdi--transit-connection-variant]', label: 'Requests', value: 'requests' },
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
const primaryTab = ref<'scenario' | 'routes' | 'actions' | 'stack'>('scenario')
const inspectorTab = ref<'scope' | 'options' | 'page' | 'app' | 'toast' | 'storage' | 'requests'>('scope')
const themeMode = ref<ThemeMode>('auto')
const systemPrefersDark = ref(false)
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

const statusChips = computed(() => [
  { label: '路由', value: pageRoutes.value.length },
  { label: '栈', value: pageStack.value.length },
  { label: '当前页', value: currentRoute.value },
])

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
</script>

<template>
  <main class="mx-auto grid h-screen w-[min(1520px,calc(100vw-16px))] grid-rows-[auto_minmax(0,1fr)] gap-2 py-2 max-[1180px]:h-auto max-[1180px]:grid-rows-none max-[1180px]:pb-3">
    <section v-if="errorMessage" :class="cn(alertCard(), 'grid gap-1')">
      <strong class="text-sm font-semibold">🕛 运行时错误</strong>
      <pre class="m-0 overflow-auto whitespace-pre-wrap text-xs leading-6">{{ errorMessage }}</pre>
    </section>

    <section class="grid h-full min-h-0 gap-2 [grid-template-columns:396px_minmax(0,1fr)] max-[1180px]:h-auto max-[1180px]:grid-cols-1">
      <aside class="sticky top-0 min-h-0 max-[1180px]:static">
        <DevicePreview
          :route="currentRoute"
          :markup="previewMarkup"
          @back="run(() => session?.navigateBack())"
          @dispatch-tap-chain="handleDispatchTapChain"
          @select-scope="handleSelectScope"
        />
      </aside>

      <section class="grid min-h-0 gap-2 [grid-template-rows:auto_minmax(0,1fr)_minmax(0,1fr)] max-[1180px]:[grid-template-rows:auto_auto_auto]">
        <section :class="toolbarSurface()">
          <div class="grid min-w-0 flex-1 gap-2">
            <div class="flex min-w-0 items-baseline gap-2">
              <span :class="labelClass">项目</span>
              <strong class="truncate text-[15px] font-semibold tracking-tight text-[color:var(--sim-text)]">
                {{ projectLabel }}
              </strong>
            </div>
            <div :class="chipWrapClass" aria-label="当前会话状态">
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
          </div>

          <div class="flex flex-wrap items-center justify-start gap-2 xl:justify-end" role="group" aria-label="主题切换">
            <span :class="labelClass">Theme</span>
            <button
              v-for="option in themeOptions"
              :key="option.value"
              :class="pill({ tone: themeMode === option.value ? 'accent' : 'neutral' })"
              @click="setThemeMode(option.value)"
            >
              <span :class="cn(option.icon, 'text-sm')" aria-hidden="true" />
              {{ option.label }}
            </button>
            <span :class="mutedTextClass">当前：{{ effectiveTheme.toUpperCase() }}</span>
          </div>
        </section>

        <section :class="tabPanelStyles.base()">
          <div :class="tabPanelStyles.bar()" role="tablist" aria-label="运行区">
            <button
              v-for="tab in primaryTabs"
              :key="tab.value"
              :aria-selected="primaryTab === tab.value"
              :class="tabButton({ active: primaryTab === tab.value })"
              @click="primaryTab = tab.value"
            >
              <span :class="cn(tab.icon, 'text-sm')" aria-hidden="true" />
              {{ tab.label }}
            </button>
          </div>
          <div :class="tabPanelStyles.body()">
            <ScenarioSelector
              v-if="primaryTab === 'scenario'"
              :active-id="currentScenarioId"
              :loading="loading"
              :scenarios="builtInScenarios"
              @pick="handlePickScenario"
              @pick-directory="handleDirectoryChange"
            />

            <RoutePanel
              v-else-if="primaryTab === 'routes'"
              :current-route="currentPage?.route ?? ''"
              :routes="pageRoutes"
              @open="handleOpenRoute"
            />

            <ActionPanel
              v-else-if="primaryTab === 'actions'"
              :methods="callableMethods"
              @call-method="handleCallMethod"
              @page-scroll="run(() => session?.pageScrollTo({ scrollTop: 128 }))"
              @pull-refresh="run(() => session?.triggerPullDownRefresh())"
              @reach-bottom="run(() => session?.triggerReachBottom())"
              @route-done="run(() => session?.triggerRouteDone({ from: 'web-demo' }))"
              @resize="run(() => session?.triggerResize({ size: { windowWidth: 412, windowHeight: 915 } }))"
            />

            <StackPanel v-else :routes="pageStack" />
          </div>
        </section>

        <section :class="tabPanelStyles.base()">
          <div :class="tabPanelStyles.bar()" role="tablist" aria-label="检查区">
            <button
              v-for="tab in inspectorTabs"
              :key="tab.value"
              :aria-selected="inspectorTab === tab.value"
              :class="tabButton({ active: inspectorTab === tab.value })"
              @click="inspectorTab = tab.value"
            >
              <span :class="cn(tab.icon, 'text-sm')" aria-hidden="true" />
              {{ tab.label }}
            </button>
          </div>
          <div :class="tabPanelStyles.body()">
            <ScopePanel
              v-if="inspectorTab === 'scope'"
              :scope-id="selectedScope?.scopeId ?? ''"
              :scope-type="selectedScope?.type ?? '未选中'"
              :methods="selectedScope?.methods ?? []"
              :properties-code="stringify(selectedScope?.properties ?? {})"
              :data-code="stringify(selectedScope?.data ?? {})"
              :theme="effectiveTheme"
            />

            <JsonPanel
              v-else-if="inspectorTab === 'options'"
              title="🕛 页面参数"
              subtitle="当前页面 options 快照。"
              :code="currentOptions"
              :theme="effectiveTheme"
            />
            <JsonPanel
              v-else-if="inspectorTab === 'page'"
              title="🕛 页面数据"
              subtitle="当前页面 data 快照。"
              :code="pageData"
              :theme="effectiveTheme"
            />
            <JsonPanel
              v-else-if="inspectorTab === 'app'"
              title="🕛 应用数据"
              subtitle="App.globalData，用来观察启动和找不到页面等轨迹。"
              :code="appData"
              :theme="effectiveTheme"
            />
            <JsonPanel
              v-else-if="inspectorTab === 'toast'"
              title="🕛 Toast"
              subtitle="showToast / hideToast 的宿主快照。"
              :code="toastData"
              :theme="effectiveTheme"
            />
            <JsonPanel
              v-else-if="inspectorTab === 'storage'"
              title="🕛 Storage"
              subtitle="setStorageSync / getStorageSync 当前内存快照。"
              :code="storageData"
              :theme="effectiveTheme"
            />
            <JsonPanel
              v-else
              title="🕛 Requests"
              subtitle="request mock 命中日志。"
              :code="requestLogData"
              :theme="effectiveTheme"
            />
          </div>
        </section>
      </section>
    </section>
  </main>
</template>
