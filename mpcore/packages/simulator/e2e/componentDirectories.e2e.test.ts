import { expect, it } from 'vitest'
import { createApp, defineComponent, h, nextTick } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbench } from '../../../demos/web/src/composables/useWorkbench'
import { builtInScenarios } from '../../../demos/web/src/scenarios'
import { createBrowserVirtualFiles } from '../src/browser'
import { componentDirectoryFiles } from '../test/helpers/componentDirectories'

interface ComponentDirectoryBridge {
  callComponentMethod: (scopeId: string, method: string) => void
  findComponentScopeIds: (selector: string) => string[]
  getState: () => {
    currentRoute: string
    currentScenarioId: string
    errorMessage: string
    previewMarkup: string
  }
  pickScenario: (scenarioId: string) => void
  readScopeSnapshot: (scopeId: string) => unknown
}

it('loads directory components through the browser demo bridge and preserves their rendered state', async () => {
  const scenario = {
    id: 'component-directories',
    name: 'Component directories',
    description: '相对路径、根路径目录入口与显式组件入口优先级。',
    files: createBrowserVirtualFiles(componentDirectoryFiles),
  }
  const surface = window as unknown as { __SIMULATOR_E2E__?: ComponentDirectoryBridge }
  const previousBridge = surface.__SIMULATOR_E2E__
  const mount = document.createElement('div')
  document.body.append(mount)
  builtInScenarios.push(scenario)
  let workbench!: ReturnType<typeof useWorkbench>
  const app = createApp(defineComponent({
    setup() {
      workbench = useWorkbench()
      return () => h(DevicePreview, {
        markup: workbench.previewMarkup.value,
        route: workbench.currentRoute.value,
        viewportHeight: 812,
        viewportWidth: 375,
      })
    },
  }))
  try {
    app.mount(mount)
    const bridge = surface.__SIMULATOR_E2E__!
    bridge.pickScenario(scenario.id)
    await nextTick()
    expect(bridge.getState()).toMatchObject({
      currentRoute: 'pages/index/index',
      currentScenarioId: scenario.id,
      errorMessage: '',
    })
    const shadow = Array.from(mount.querySelectorAll('div')).find(element => element.shadowRoot)?.shadowRoot
    expect(shadow).toBeTruthy()
    expect(shadow!.querySelector('#host .host-value')?.textContent).toBe('host:initial')
    expect(shadow!.querySelector('#nested .leaf-value')?.textContent).toBe('initial:0')
    expect(shadow!.querySelector('#leaf .leaf-value')?.textContent).toBe('root:0')
    expect(shadow!.querySelector('#preferred .preferred-value')?.textContent).toBe('explicit')
    expect(bridge.getState().previewMarkup).not.toContain('directory-fallback')
    const leafScopes = bridge.findComponentScopeIds('#leaf')
    expect(leafScopes).toHaveLength(1)
    expect(bridge.readScopeSnapshot(leafScopes[0]!)).toMatchObject({ data: { label: 'root', count: 0 }, type: 'component' })
    bridge.callComponentMethod(leafScopes[0]!, 'increment')
    await nextTick()
    expect(shadow!.querySelector('#leaf .leaf-value')?.textContent).toBe('root:1')
    expect(shadow!.querySelector('#nested .leaf-value')?.textContent).toBe('initial:0')
    expect(bridge.readScopeSnapshot(leafScopes[0]!)).toMatchObject({ data: { count: 1 }, type: 'component' })
    expect(bridge.getState().errorMessage).toBe('')
  }
  finally {
    workbench?.session.value?.close()
    app.unmount()
    const scenarioIndex = builtInScenarios.indexOf(scenario)
    if (scenarioIndex >= 0) {
      builtInScenarios.splice(scenarioIndex, 1)
    }
    surface.__SIMULATOR_E2E__ = previousBridge
    mount.remove()
  }
})
