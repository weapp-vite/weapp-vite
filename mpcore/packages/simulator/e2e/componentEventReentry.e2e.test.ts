import { expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserVirtualFiles } from '../src/browser'
import { componentEventReentryFiles } from '../test/helpers/componentEventReentry'

it('delivers conditional loop events once through real preview clicks across reentrant updates', async () => {
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
    workbench.loadSession('component-event-reentry', createBrowserVirtualFiles(componentEventReentryFiles))
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    const page = workbench.session.value!.getCurrentPages().at(-1)!
    const expectState = async (count: number, summary: string, order = 'alpha,beta', visible = 'visible') => {
      await vi.waitFor(() => expect({
        count: shadow.querySelector('#issue1235-count')?.textContent,
        summary: shadow.querySelector('#issue1235-summary')?.textContent,
        order: shadow.querySelector('#issue1235-order')?.textContent,
        visible: shadow.querySelector('#issue1235-visible')?.textContent,
      }).toEqual({ count: String(count), summary, order, visible }))
      expect(page.data.received).toHaveLength(count)
    }
    const click = (row: string) => shadow.querySelector<HTMLElement>(`#child-${row} #emit-${row}`)!.click()

    await expectState(0, '')
    click('alpha')
    await expectState(1, 'original:alpha')
    workbench.handleCallMethod('replaceHandler')
    await vi.waitFor(() => expect(shadow.querySelector('#issue1235-handler')?.textContent).toBe('replacement'))
    click('beta')
    await expectState(2, 'original:alpha,replacement:beta')
    expect(page.data.handlerReplaced).toBe(true)

    workbench.run(() => page.setMode('reorder'))
    click('alpha')
    await expectState(3, 'original:alpha,replacement:beta,replacement:alpha', 'beta,alpha')
    workbench.run(() => page.setMode('unmount'))
    click('beta')
    await expectState(4, 'original:alpha,replacement:beta,replacement:alpha,replacement:beta', 'beta,alpha', 'hidden')
    expect(shadow.querySelector('#child-alpha')).toBeNull()
    expect(shadow.querySelector('#child-beta')).toBeNull()
    workbench.handleCallMethod('restoreChildren')
    await expectState(4, 'original:alpha,replacement:beta,replacement:alpha,replacement:beta', 'beta,alpha')
    click('alpha')
    await expectState(5, 'original:alpha,replacement:beta,replacement:alpha,replacement:beta,replacement:alpha', 'beta,alpha')

    workbench.handleOpenRoute('pages/empty/index')
    await vi.waitFor(() => expect(shadow.querySelector('#issue1235-empty')?.textContent).toBe('unloaded'))
    workbench.handleOpenRoute('pages/index/index')
    await vi.waitFor(() => expect(shadow.querySelector('#issue1235-count')?.textContent).toBe('0'))
    expect(workbench.session.value!.getCurrentPages().at(-1)!.data.received).toEqual([])
    expect(workbench.errorMessage.value).toBe('')
  }
  finally {
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
  }
})
