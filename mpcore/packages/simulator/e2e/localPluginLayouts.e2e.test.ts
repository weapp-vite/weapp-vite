import type { App as VueApp } from 'vue'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { createApp, defineComponent, h } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbench } from '../../../demos/web/src/composables/useWorkbench'
import { builtInScenarios } from '../../../demos/web/src/scenarios'
import { createBrowserVirtualFiles } from '../src/browser'
import { createLocalPluginDemoFiles, localPluginLayouts, localPluginPageRoute } from '../test/helpers/localPluginLayouts'
import '../../../demos/web/src/styles.css'

interface PluginLayoutDemoBridge {
  findComponentScopeIds: (selector: string) => string[]
  getState: () => {
    currentRoute: string
    currentScenarioId: string
    errorMessage: string
    pageData: string
    pageStack: string[]
  }
  navigateBack: () => void
  pickScenario: (scenarioId: string) => void
  readScopeSnapshot: (scopeId: string) => unknown
  runPageMethod: (method: string) => void
}

function readBridge() {
  return (window as Window & { __SIMULATOR_E2E__?: PluginLayoutDemoBridge }).__SIMULATOR_E2E__
}

describe('local plugin layouts in the public browser demo', { concurrent: false }, () => {
  const scenarios = localPluginLayouts.map(layout => ({
    description: `Local plugin runtime from the ${layout} layout`,
    files: createBrowserVirtualFiles(createLocalPluginDemoFiles(layout)),
    id: `local-plugin-layout-${layout.toLowerCase()}`,
    name: `Local plugin ${layout}`,
  }))
  let app: VueApp | undefined
  let mount: HTMLDivElement | undefined
  let workbench: ReturnType<typeof useWorkbench> | undefined

  function previewElement(selector: string) {
    return Array.from(mount?.querySelectorAll('*') ?? [])
      .map(element => element.shadowRoot)
      .find((root): root is ShadowRoot => root !== null)
      ?.querySelector<HTMLElement>(selector)
  }

  beforeAll(async () => {
    // 这里只验证 P/W 同一插件的 runtime、DOM 和导航；demo 接收虚拟根格式，不解析磁盘 project.config。
    builtInScenarios.push(...scenarios)
    mount = document.createElement('div')
    document.body.append(mount)
    app = createApp(defineComponent({
      setup() {
        const demo = useWorkbench()
        workbench = demo
        return () => h(DevicePreview, {
          markup: demo.previewMarkup.value,
          route: demo.currentRoute.value,
          styleText: demo.previewStyles.value,
          viewportHeight: demo.viewportSize.value.height,
          viewportWidth: demo.viewportSize.value.width,
          onDispatchTap: demo.handleDispatchTap,
          onSelectScope: demo.handleSelectScope,
          onUpdateViewport: demo.handleUpdateViewport,
        })
      },
    }))
    app.mount(mount)
  })

  afterAll(() => {
    workbench?.session.value?.close()
    app?.unmount()
    mount?.remove()
    delete (window as Window & { __SIMULATOR_E2E__?: PluginLayoutDemoBridge }).__SIMULATOR_E2E__
    for (const scenario of scenarios) {
      const index = builtInScenarios.indexOf(scenario)
      if (index >= 0) {
        builtInScenarios.splice(index, 1)
      }
    }
  })

  it.each(scenarios)('renders the $name counterpart and navigates through its plugin', async (scenario) => {
    await expect.poll(readBridge).toBeDefined()
    const bridge = readBridge()!
    bridge.pickScenario(scenario.id)
    await expect.poll(() => bridge.getState().currentScenarioId).toBe(scenario.id)
    await expect.poll(() => previewElement('#plugin-card-content')?.textContent).toBe('plugin card: 42')
    expect(bridge.getState()).toMatchObject({ currentRoute: 'pages/index/index', errorMessage: '' })
    const pageData: unknown = JSON.parse(bridge.getState().pageData)
    expect(pageData).toMatchObject({ pluginAnswer: 42 })
    const card = previewElement('#plugin-card-content')!
    expect(card.getBoundingClientRect().height).toBeGreaterThan(0)
    expect(getComputedStyle(card).visibility).toBe('visible')

    const scopeIds = bridge.findComponentScopeIds('#local-plugin-card')
    expect(scopeIds).toHaveLength(1)
    expect(bridge.readScopeSnapshot(scopeIds[0]!)).toMatchObject({
      properties: { label: 42 },
      scopeId: scopeIds[0],
      type: 'component',
    })
    bridge.runPageMethod('readPluginAnswer')
    await expect.poll(() => bridge.readScopeSnapshot('page:pages/index/index')).toMatchObject({
      data: { apiAnswer: 42, pluginAnswer: 42 },
    })

    bridge.runPageMethod('openPluginPage')
    await expect.poll(() => bridge.getState().currentRoute).toBe(localPluginPageRoute)
    await expect.poll(() => previewElement('#local-plugin-page')?.textContent).toBe('plugin page')
    expect(bridge.getState()).toMatchObject({
      errorMessage: '',
      pageStack: ['pages/index/index', localPluginPageRoute],
    })
    expect(bridge.readScopeSnapshot(`page:${localPluginPageRoute}`)).toMatchObject({ properties: { source: 'host' } })

    bridge.navigateBack()
    await expect.poll(() => bridge.getState().currentRoute).toBe('pages/index/index')
    await expect.poll(() => previewElement('#plugin-card-content')?.textContent).toBe('plugin card: 42')
    expect(bridge.findComponentScopeIds('#local-plugin-card')).toEqual(scopeIds)
  })
})
