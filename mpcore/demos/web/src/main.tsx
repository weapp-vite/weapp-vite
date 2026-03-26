import {
  createBrowserHeadlessSession,
  createBrowserVirtualFilesFromDirectory,
  renderBrowserPageTree,
  type BrowserDirectoryFileLike,
  type BrowserHeadlessSession,
} from '../../../packages/simulator/src/browser'
import {
  computed,
  createApp,
  defineComponent,
  ref,
} from 'vue'
import { builtInScenarios } from './scenarios'
import './styles.css'

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

function stringify(value: unknown) {
  return JSON.stringify(value, null, 2)
}

interface SessionLike {
  getCurrentPages: () => Array<Record<string, any>>
}

function collectCallableMethods(session: SessionLike | null) {
  const page = session?.getCurrentPages().at(-1)
  if (!page) {
    return []
  }

  return Object.keys(page)
    .filter((key) => typeof page[key] === 'function')
    .filter(key => !HOOK_NAMES.has(key))
    .filter(key => !key.startsWith('__'))
    .sort((a, b) => a.localeCompare(b))
}

const App = defineComponent(() => {
  const revision = ref(0)
  const session = ref<BrowserHeadlessSession | null>(null)
  const errorMessage = ref('')
  const projectLabel = ref('No project loaded')
  const loading = ref(false)
  const currentScenarioId = ref<string | null>(null)

  const currentPage = computed(() => {
    revision.value
    return session.value?.getCurrentPages().at(-1) ?? null
  })

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
      return renderBrowserPageTree(session.value.files, session.value.project, currentPage.value).wxml
    }
    catch (error) {
      return `<page><view class="sim-preview-error">${String((error as Error).message ?? error)}</view></page>`
    }
  })

  const pageData = computed(() => {
    revision.value
    return currentPage.value ? stringify(currentPage.value.data) : '{}'
  })

  const appData = computed(() => {
    revision.value
    return stringify(session.value?.getApp()?.globalData ?? {})
  })

  const currentOptions = computed(() => {
    revision.value
    return stringify(currentPage.value?.options ?? {})
  })

  function touch() {
    revision.value += 1
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

  function loadScenario(label: string, files: BrowserHeadlessSession['files'], scenarioId?: string) {
    errorMessage.value = ''
    const nextSession = createBrowserHeadlessSession({
      files,
    })
    session.value = nextSession
    currentScenarioId.value = scenarioId ?? null
    projectLabel.value = label
    const firstRoute = nextSession.project.routes[0]?.route
    if (firstRoute) {
      nextSession.reLaunch(`/${firstRoute}`)
    }
    touch()
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
      loadScenario(files[0]?.webkitRelativePath?.split('/')[0] ?? 'Selected dist', virtualFiles)
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

  const directoryInputProps = {
    webkitdirectory: '',
  } as any

  if (!session.value) {
    loadScenario(builtInScenarios[0]!.name, builtInScenarios[0]!.files, builtInScenarios[0]!.id)
  }

  return () => (
    <main class="sim-shell">
      <section class="sim-hero">
        <div class="sim-hero__copy">
          <p class="sim-eyebrow">MPCore Browser Runtime</p>
          <h1>Web Simulator Deck</h1>
          <p class="sim-lead">
            Select a built mini-program output directory and drive the headless simulator inside the browser.
            Routes, page methods, lifecycle events, and rendered WXML stay visible while you poke the runtime.
          </p>
        </div>
        <label class={['sim-loader', loading.value && 'is-loading']}>
          <span class="sim-loader__title">Load built output</span>
          <span class="sim-loader__hint">Choose a directory that already contains app.json, app.js, and page bundles.</span>
          <input
            type="file"
            multiple
            {...directoryInputProps}
            onChange={handleDirectoryChange}
          />
        </label>
      </section>

      <section class="sim-scenarios">
        {builtInScenarios.map(scenario => (
          <button
            class={['sim-scenario-card', currentScenarioId.value === scenario.id && 'is-active']}
            onClick={() => run(() => {
              loadScenario(scenario.name, scenario.files, scenario.id)
            })}
          >
            <span class="sim-scenario-card__title">{scenario.name}</span>
            <span class="sim-scenario-card__body">{scenario.description}</span>
          </button>
        ))}
      </section>

      <section class="sim-metrics">
        <article class="sim-metric">
          <span>Project</span>
          <strong>{projectLabel.value}</strong>
        </article>
        <article class="sim-metric">
          <span>Routes</span>
          <strong>{pageRoutes.value.length}</strong>
        </article>
        <article class="sim-metric">
          <span>Stack Depth</span>
          <strong>{pageStack.value.length}</strong>
        </article>
        <article class="sim-metric">
          <span>Current Route</span>
          <strong>{currentPage.value?.route ?? 'n/a'}</strong>
        </article>
      </section>

      {errorMessage.value
        ? (
            <section class="sim-error">
              <strong>Runtime error</strong>
              <pre>{errorMessage.value}</pre>
            </section>
          )
        : null}

      <section class="sim-grid">
        <article class="sim-panel sim-panel--routes">
          <header class="sim-panel__header">
            <h2>Routes</h2>
            <p>Use reLaunch to enter any built page instantly.</p>
          </header>
          <div class="sim-chip-list">
            {pageRoutes.value.map(route => (
              <button
                class={['sim-chip', currentPage.value?.route === route && 'is-active']}
                onClick={() => run(() => {
                  session.value?.reLaunch(`/${route}`)
                })}
              >
                {route}
              </button>
            ))}
          </div>
        </article>

        <article class="sim-panel sim-panel--preview">
          <header class="sim-panel__header">
            <h2>Preview</h2>
            <p>Rendered WXML is mounted as live custom-element DOM.</p>
          </header>
          <div class="sim-preview-frame">
            <div class="sim-preview-device">
              <div class="sim-preview-toolbar">
                <span>{currentPage.value?.route ?? 'No page loaded'}</span>
                <button onClick={() => run(() => session.value?.navigateBack())}>navigateBack</button>
              </div>
              <div class="sim-preview-surface" innerHTML={previewMarkup.value}></div>
            </div>
          </div>
        </article>

        <article class="sim-panel">
          <header class="sim-panel__header">
            <h2>Page Controls</h2>
            <p>Invoke exposed page methods and synthetic runtime events.</p>
          </header>
          <div class="sim-action-group">
            {callableMethods.value.length === 0
              ? <p class="sim-muted">No callable page methods on the current page.</p>
              : callableMethods.value.map(method => (
                  <button onClick={() => run(() => {
                    const page = session.value?.getCurrentPages().at(-1)
                    page?.[method]?.()
                  })}
                  >
                    call {method}()
                  </button>
                ))}
          </div>
          <div class="sim-action-group sim-action-group--secondary">
            <button onClick={() => run(() => session.value?.pageScrollTo({ scrollTop: 128 }))}>pageScrollTo(128)</button>
            <button onClick={() => run(() => session.value?.triggerPullDownRefresh())}>triggerPullDownRefresh()</button>
            <button onClick={() => run(() => session.value?.triggerReachBottom())}>triggerReachBottom()</button>
            <button onClick={() => run(() => session.value?.triggerRouteDone({ from: 'web-demo' }))}>triggerRouteDone()</button>
            <button onClick={() => run(() => session.value?.triggerResize({ size: { windowWidth: 412, windowHeight: 915 } }))}>triggerResize()</button>
          </div>
        </article>

        <article class="sim-panel">
          <header class="sim-panel__header">
            <h2>Route Stack</h2>
            <p>Current pages returned by getCurrentPages().</p>
          </header>
          <ol class="sim-stack">
            {pageStack.value.map((route, index) => (
              <li class={index === pageStack.value.length - 1 ? 'is-current' : ''}>{route}</li>
            ))}
          </ol>
        </article>

        <article class="sim-panel">
          <header class="sim-panel__header">
            <h2>Page State</h2>
            <p>Current route options and data snapshot.</p>
          </header>
          <div class="sim-code-block">
            <span class="sim-code-label">options</span>
            <pre>{currentOptions.value}</pre>
          </div>
          <div class="sim-code-block">
            <span class="sim-code-label">data</span>
            <pre>{pageData.value}</pre>
          </div>
        </article>

        <article class="sim-panel">
          <header class="sim-panel__header">
            <h2>App GlobalData</h2>
            <p>Launch and page-not-found traces show up here when the app records them.</p>
          </header>
          <div class="sim-code-block">
            <pre>{appData.value}</pre>
          </div>
        </article>
      </section>
    </main>
  )
})

createApp(App).mount('#app')
