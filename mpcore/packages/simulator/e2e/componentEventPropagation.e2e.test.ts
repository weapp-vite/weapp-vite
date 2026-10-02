import { expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserVirtualFiles } from '../src/browser'
import { componentEventPropagationFiles } from '../test/helpers/componentEventPropagation'

it('propagates local and composed component signals from real workbench preview clicks', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const viewport = ref({ height: 844, width: 390 })
  const workbench = useWorkbenchSession(viewport)
  const app = createApp({
    setup: () => () => h(DevicePreview, {
      markup: workbench.previewMarkup.value,
      styleText: workbench.previewStyles.value,
      route: workbench.currentRoute.value,
      viewportHeight: viewport.value.height,
      viewportWidth: viewport.value.width,
      onDispatchTap: workbench.handleDispatchTap,
      onSelectScope: workbench.handleSelectScope,
    }),
  })
  app.mount(preview)
  try {
    workbench.loadSession('component-event-propagation', createBrowserVirtualFiles(componentEventPropagationFiles))
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    await vi.waitFor(() => expect(shadow.querySelector('#page-result')?.textContent).toBe('0/0'))

    const scenarios = [
      ['source-host', 'private', 'direct', 11, '0/0'],
      ['source-host', 'capture', 'capture,direct', 19, '0/0'],
      ['source-host', 'local', 'capture,direct,bubble', 23, '0/0'],
      ['source-host', 'public', 'capture,direct,bubble', 37, '1/37'],
      ['catch-host', 'public', 'capture,catch', 37, '1/37'],
      ['capture-catch-host', 'public', 'capture,capture-catch', 37, '1/37'],
    ] as const
    for (const [host, kind, trace, value, pageResult] of scenarios) {
      shadow.querySelector<HTMLElement>('#reset-signal')!.click()
      await vi.waitFor(() => expect(shadow.querySelector('#signal-trace')?.textContent).toBe(''))
      shadow.querySelector<HTMLElement>(`#${host} #emit-${kind}`)!.click()
      await vi.waitFor(() => expect({
        trace: shadow.querySelector('#signal-trace')?.textContent,
        source: shadow.querySelector('#signal-result')?.textContent,
        page: shadow.querySelector('#page-result')?.textContent,
      }).toEqual({
        trace,
        source: `${value}/${host}`,
        page: pageResult,
      }))
    }
  }
  finally {
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
  }
})
