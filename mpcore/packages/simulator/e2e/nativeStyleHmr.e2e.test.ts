import { expect, it } from 'vitest'
// eslint-disable-next-line wevu/no-unsupported-api -- 仅浏览器 E2E 的 Vue 宿主，不进入小程序产物。
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserVirtualFiles } from '../src/browser'
import { createNativeStyleHmrFiles, nativeStyleHmrStages } from '../test/helpers/nativeStyleHmr'

it.each(['Page', 'Component'] as const)('renders native %s style restoration and local priority without losing state', async (registration) => {
  const mount = document.createElement('div')
  document.body.append(mount)
  let workbench!: ReturnType<typeof useWorkbenchSession>
  const app = createApp(defineComponent({
    setup() {
      const viewport = ref({ width: 375, height: 812 })
      workbench = useWorkbenchSession(viewport)
      workbench.loadSession('Native style HMR', createBrowserVirtualFiles([...createNativeStyleHmrFiles(registration, 0)]))
      return () => h(DevicePreview, {
        markup: workbench.previewMarkup.value,
        styleText: workbench.previewStyles.value,
        route: workbench.currentRoute.value,
        viewportWidth: viewport.value.width,
        viewportHeight: viewport.value.height,
        onDispatchTapChain: workbench.handleDispatchTapChain,
        onSelectScope: workbench.handleSelectScope,
        onUpdateViewport: workbench.handleUpdateViewport,
      })
    },
  }))
  app.mount(mount)
  try {
    await nextTick()
    const shadow = Array.from(mount.querySelectorAll('div')).find(element => element.shadowRoot)?.shadowRoot
    expect(shadow).toBeTruthy()
    const element = (selector: string) => {
      const result = shadow!.querySelector<HTMLElement>(selector)
      expect(result, selector).not.toBeNull()
      return result!
    }
    const session = workbench.session.value!
    const page = session.getCurrentPages()[0]
    const nativeApp = session.getApp()
    for (const [index, stage] of nativeStyleHmrStages.entries()) {
      if (index === 1) {
        element('#native-increment').click()
        await nextTick()
      }
      workbench.run(() => {
        for (const [file, source] of createNativeStyleHmrFiles(registration, index)) {
          session.files.set(file, source)
        }
      })
      await nextTick()
      expect(element('#native-style-probe').getAttribute('data-stage')).toBe(String(index))
      expect(getComputedStyle(element('#native-style-probe')).backgroundColor).toBe(stage.color)
      expect(element('#native-count').textContent).toBe(index === 0 ? '0' : '1')
      if (index === nativeStyleHmrStages.length - 1) {
        expect(getComputedStyle(element('#native-local-probe')).backgroundColor).toBe('rgb(31, 41, 55)')
      }
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(nativeApp)
      expect(workbench.errorMessage.value).toBe('')
    }
  }
  finally {
    workbench.session.value?.close()
    app.unmount()
    mount.remove()
  }
})
