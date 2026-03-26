<script setup lang="ts">
import {
  createBrowserHeadlessSession,
  createBrowserVirtualFilesFromDirectory,
  type BrowserDirectoryFileLike,
  type BrowserHeadlessSession,
} from '../../../packages/simulator/src/browser'
import { computed, ref } from 'vue'
import ActionPanel from './components/ActionPanel.vue'
import DevicePreview from './components/DevicePreview.vue'
import JsonPanel from './components/JsonPanel.vue'
import RoutePanel from './components/RoutePanel.vue'
import ScenarioSelector from './components/ScenarioSelector.vue'
import ScopePanel from './components/ScopePanel.vue'
import StackPanel from './components/StackPanel.vue'
import StatsBar from './components/StatsBar.vue'
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

interface SessionLike {
  getCurrentPages: () => Array<Record<string, any>>
}

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

const currentPage = computed(() => {
  revision.value
  return session.value?.getCurrentPages().at(-1) ?? null
})

const currentRoute = computed(() => currentPage.value?.route ?? '未加载页面')

const pageRoutes = computed(() => {
  revision.value
  return session.value?.project.routes.map(route => route.route) ?? []
})

const pageStack = computed(() => {
  revision.value
  return session.value?.getCurrentPages().map(page => page.route) ?? []
})

const callableMethods = computed(() => {
  revision.value
  return collectCallableMethods(session.value)
})

const previewMarkup = computed(() => {
  revision.value
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
  revision.value
  return stringify(currentPage.value?.data ?? {})
})

const appData = computed(() => {
  revision.value
  return stringify(session.value?.getApp()?.globalData ?? {})
})

const currentOptions = computed(() => {
  revision.value
  return stringify(currentPage.value?.options ?? {})
})

const stats = computed(() => [
  { label: '🕛 项目', value: projectLabel.value },
  { label: '🕛 路由数', value: pageRoutes.value.length },
  { label: '🕛 栈深度', value: pageStack.value.length },
  { label: '🕛 当前页', value: currentRoute.value },
])

const selectedScope = computed(() => {
  revision.value
  if (!session.value || !selectedScopeId.value) {
    return null
  }
  return session.value.getScopeSnapshot(selectedScopeId.value)
})

function touch() {
  revision.value += 1
}

function loadSession(label: string, files: BrowserHeadlessSession['files'], scenarioId?: string) {
  const nextSession = createBrowserHeadlessSession({ files })
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

function handleCallScopeMethod(payload: { method: string, scopeId: string }) {
  run(() => {
    session.value?.callTapBinding(payload.scopeId, payload.method)
    selectedScopeId.value = payload.scopeId
  })
}

function handleSelectScope(scopeId: string) {
  selectedScopeId.value = scopeId
  touch()
}
</script>

<template>
  <main class="sim-app">
    <header class="sim-topbar">
      <div class="sim-topbar__copy">
        <p class="sim-topbar__eyebrow">🕛 浏览器模拟器</p>
        <h1 class="sim-topbar__title">小程序目录即场景</h1>
        <p class="sim-topbar__lead">
          左边固定是模拟器预览，右边拆成更细的小卡片。内置样例和你自己的构建目录都能直接切换。
        </p>
      </div>
    </header>

    <StatsBar :items="stats" />

    <section v-if="errorMessage" class="sim-alert">
      <strong>🕛 运行时错误</strong>
      <pre>{{ errorMessage }}</pre>
    </section>

    <section class="sim-workbench">
      <aside class="sim-workbench__left">
        <DevicePreview
          :route="currentRoute"
          :markup="previewMarkup"
          @back="run(() => session?.navigateBack())"
          @call-method="handleCallMethod"
          @call-scope-method="handleCallScopeMethod"
          @select-scope="handleSelectScope"
        />
      </aside>

      <section class="sim-workbench__right">
        <ScenarioSelector
          :active-id="currentScenarioId"
          :loading="loading"
          :scenarios="builtInScenarios"
          @pick="handlePickScenario"
          @pick-directory="handleDirectoryChange"
        />

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
          @resize="run(() => session?.triggerResize({ size: { windowWidth: 412, windowHeight: 915 } }))"
        />

        <StackPanel :routes="pageStack" />

        <ScopePanel
          :scope-id="selectedScope?.scopeId ?? ''"
          :scope-type="selectedScope?.type ?? '未选中'"
          :methods="selectedScope?.methods ?? []"
          :properties-code="stringify(selectedScope?.properties ?? {})"
          :data-code="stringify(selectedScope?.data ?? {})"
        />

        <JsonPanel title="🕛 页面参数" subtitle="当前页面 options 快照。" :code="currentOptions" />
        <JsonPanel title="🕛 页面数据" subtitle="当前页面 data 快照。" :code="pageData" />
        <JsonPanel title="🕛 应用数据" subtitle="App.globalData，用来观察启动和找不到页面等轨迹。" :code="appData" />
      </section>
    </section>
  </main>
</template>
