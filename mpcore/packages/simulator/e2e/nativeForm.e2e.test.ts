import { expect, it, vi } from 'vitest'
import { createApp, h, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserVirtualFiles } from '../src/browser'
import { nativeFormFiles, nativeFormValue } from '../test/helpers/nativeForm'

it('dispatches native form activation once through real preview clicks and slot owners', async () => {
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
    workbench.loadSession('native-form', createBrowserVirtualFiles(nativeFormFiles))
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    const click = (selector: string) => shadow.querySelector<HTMLElement>(selector)!.click()
    const events = workbench.session.value!.getApp()!.globalData.events as Array<Record<string, any>>
    await vi.waitFor(() => expect(shadow.querySelector('#status')?.textContent).toBe('0/0'))
    click('#nested')
    await vi.waitFor(() => expect(shadow.querySelector('#status')?.textContent).toBe('1/1'))
    expect(events.filter(event => event.type === 'submit').map(event => event.detail.value)).toEqual([nativeFormValue])

    click('#private-button')
    click('#encapsulated-label')
    click('#disabled')
    expect(events.filter(event => event.type === 'submit')).toHaveLength(1)
    click('#slotted-label')
    expect(events.filter(event => event.type === 'submit').at(-1)).toMatchObject({
      owner: 'form-component',
      target: 'component-form',
      detail: { value: { slotted: 'in form slot' } },
    })
    click('#projected-submit')
    expect(events.filter(event => event.type === 'submit').at(-1)).toMatchObject({
      owner: 'page',
      target: 'boundary-form',
      detail: { value: { outside: 'public', grouped: 'group value', projected: 'slot value' } },
    })
    expect(events.filter(event => event.type === 'submit')).toHaveLength(3)
  }
  finally {
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
  }
})
