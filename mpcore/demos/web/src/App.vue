<script setup lang="ts">
import type { BrowserDirectoryFileLike, BrowserHeadlessSession } from '../../../packages/simulator/src/browser'
import { computed, ref } from 'vue'
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
const primaryTab = ref<'scenario' | 'routes' | 'actions' | 'stack'>('scenario')
const inspectorTab = ref<'scope' | 'options' | 'page' | 'app'>('scope')

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

const currentOptions = computed(() => {
  void revision.value
  return stringify(currentPage.value?.options ?? {})
})

const stats = computed(() => [
  { label: '🕛 项目', value: projectLabel.value },
  { label: '🕛 路由数', value: pageRoutes.value.length },
  { label: '🕛 栈深度', value: pageStack.value.length },
  { label: '🕛 当前页', value: currentRoute.value },
])

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
  <main class="sim-app">
    <header class="sim-topbar">
      <div class="sim-topbar__copy">
        <p class="sim-topbar__eyebrow">
          🕛 浏览器模拟器
        </p>
        <h1 class="sim-topbar__title">
          小程序目录即场景
        </h1>
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
          @dispatch-tap-chain="handleDispatchTapChain"
          @select-scope="handleSelectScope"
        />
      </aside>

      <section class="sim-workbench__right">
        <section class="sim-tab-panel">
          <div class="sim-tabbar" role="tablist" aria-label="运行区">
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': primaryTab === 'scenario' }"
              @click="primaryTab = 'scenario'"
            >
              场景
            </button>
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': primaryTab === 'routes' }"
              @click="primaryTab = 'routes'"
            >
              路由
            </button>
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': primaryTab === 'actions' }"
              @click="primaryTab = 'actions'"
            >
              操作
            </button>
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': primaryTab === 'stack' }"
              @click="primaryTab = 'stack'"
            >
              页面栈
            </button>
          </div>
          <div class="sim-tab-panel__body">
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

        <section class="sim-tab-panel">
          <div class="sim-tabbar" role="tablist" aria-label="检查区">
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': inspectorTab === 'scope' }"
              @click="inspectorTab = 'scope'"
            >
              Scope
            </button>
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': inspectorTab === 'options' }"
              @click="inspectorTab = 'options'"
            >
              Options
            </button>
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': inspectorTab === 'page' }"
              @click="inspectorTab = 'page'"
            >
              Page Data
            </button>
            <button
              class="sim-tabbar__tab"
              :class="{ 'is-active': inspectorTab === 'app' }"
              @click="inspectorTab = 'app'"
            >
              App Data
            </button>
          </div>
          <div class="sim-tab-panel__body">
            <ScopePanel
              v-if="inspectorTab === 'scope'"
              :scope-id="selectedScope?.scopeId ?? ''"
              :scope-type="selectedScope?.type ?? '未选中'"
              :methods="selectedScope?.methods ?? []"
              :properties-code="stringify(selectedScope?.properties ?? {})"
              :data-code="stringify(selectedScope?.data ?? {})"
            />

            <JsonPanel
              v-else-if="inspectorTab === 'options'"
              title="🕛 页面参数"
              subtitle="当前页面 options 快照。"
              :code="currentOptions"
            />
            <JsonPanel
              v-else-if="inspectorTab === 'page'"
              title="🕛 页面数据"
              subtitle="当前页面 data 快照。"
              :code="pageData"
            />
            <JsonPanel
              v-else
              title="🕛 应用数据"
              subtitle="App.globalData，用来观察启动和找不到页面等轨迹。"
              :code="appData"
            />
          </div>
        </section>
      </section>
    </section>
  </main>
</template>
