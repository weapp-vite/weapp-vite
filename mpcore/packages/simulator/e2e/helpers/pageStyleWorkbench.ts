import type { PageStyleSource } from '../../test/helpers/pageStyleImports'
import { expect } from 'vitest'

import { createApp, defineComponent, h, ref } from 'vue'
import DevicePreview from '../../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserVirtualFiles } from '../../src/browser'
import { createPageStyleImportFiles } from '../../test/helpers/pageStyleImports'

export function mountPageStyleWorkbench(source: PageStyleSource = 'imported', overrides: Array<[string, string]> = []) {
  const mount = document.createElement('div')
  document.body.append(mount)
  let workbench!: ReturnType<typeof useWorkbenchSession>
  const app = createApp(defineComponent({
    setup() {
      const viewport = ref({ width: 375, height: 812 })
      workbench = useWorkbenchSession(viewport)
      workbench.loadSession('Page WXSS sources', createBrowserVirtualFiles([...createPageStyleImportFiles(source), ...overrides]))
      return () => h(DevicePreview, {
        markup: workbench.previewMarkup.value,
        styleText: workbench.previewStyles.value,
        route: workbench.currentRoute.value,
        viewportWidth: viewport.value.width,
        viewportHeight: viewport.value.height,
        onDispatchTap: workbench.handleDispatchTap,
        onSelectScope: workbench.handleSelectScope,
        onUpdateViewport: workbench.handleUpdateViewport,
      })
    },
  }))
  app.mount(mount)
  const shadow = Array.from(mount.querySelectorAll('div')).find(element => element.shadowRoot)?.shadowRoot
  expect(shadow).toBeTruthy()
  return {
    workbench,
    element(selector: string) {
      const element = shadow!.querySelector<HTMLElement>(selector)
      expect(element, selector).not.toBeNull()
      return element!
    },
    close() {
      workbench.session.value?.close()
      app.unmount()
      mount.remove()
    },
  }
}
