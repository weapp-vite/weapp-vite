import { expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserVirtualFiles } from '../src/browser'
import { nativeSlotEventFiles } from '../test/helpers/nativeSlotEvents'

it('keeps native slot host context through real preview clicks and recreation', async () => {
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
    workbench.loadSession('native-slot-events', createBrowserVirtualFiles(nativeSlotEventFiles))
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    const text = (selector: string) => shadow.querySelector(selector)?.textContent
    const click = (selector: string) => shadow.querySelector<HTMLElement>(selector)!.click()
    await vi.waitFor(() => expect(text('#leaf-left')).toBe('left/0/true'))
    expect(text('#leaf-right')).toBe('right/10/true')
    expect(text('#leaf-inner')).toBe('inner/200/true')
    expect(text('#leaf-inner-internal')).toBe('inner/200/true')
    expect(text('#export-inner-internal')).toBe('increment,label')
    click('#leaf-inner-internal')
    await vi.waitFor(() => expect(text('#host-inner')).toBe('201'))
    expect(text('#host-outer')).toBe('100')
    click('#leaf-left')
    await vi.waitFor(() => expect(text('#host-left')).toBe('1'))
    expect(text('#host-right')).toBe('10')
    click('#leaf-inner')
    await vi.waitFor(() => expect(text('#host-inner')).toBe('202'))
    expect(text('#host-outer')).toBe('100')
    click('#toggle')
    await vi.waitFor(() => expect(text('#leaf-left')).toBeUndefined())
    click('#toggle')
    await vi.waitFor(() => expect(text('#leaf-left')).toBe('left/40/true'))
    click('#leaf-left')
    await vi.waitFor(() => expect(text('#host-left')).toBe('41'))
    expect(text('#host-right')).toBe('10')
    expect(text('#host-inner')).toBe('202')
  }
  finally {
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
  }
})
