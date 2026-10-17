import { expect, it, vi } from 'vitest'
import { page as browserPage } from 'vitest/browser'
import { createApp, h, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { HeadlessTestingNodeHandle } from '../src/view/nodeHandle'
import { richTextFiles, richTextHtmlText, untrustedRichText, untrustedRichTextContent, untrustedRichTextHtml, untrustedRichTextHtmlContent } from '../test/helpers/richText'

it('renders structured and HTML rich text as inert browser content across replacement and clearing', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(richTextFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    const tree = session.renderCurrentPage()
    preview.innerHTML = tree.wxml
    return new HeadlessTestingNodeHandle(tree.root, {
      callMethod: (scopeId, method, event) => session.callScopeMethod(scopeId, method, event),
      createPageHandle: () => ({ data: async () => session.getCurrentPages().at(-1)?.data }),
      createScopeHandle: () => null,
      ownerScopeId: () => null,
    })
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    const root = render()
    expect(preview.querySelector('#structured p')?.textContent).toBe('Rendered content')
    expect(await (await root.$('#structured'))!.text()).toBe('Rendered content')
    expect(preview.querySelector('#plain')?.textContent).toBe('Rendered content')
    expect(preview.querySelector('#html')?.textContent).toBe(richTextHtmlText)
    expect(await (await root.$('#html'))!.text()).toBe(richTextHtmlText)
    expect(preview.querySelector('#literal')?.textContent).toBe('literal & text')
    expect(preview.querySelector('#empty')?.childNodes).toHaveLength(0)

    for (const [nodes, expected] of [[untrustedRichText, untrustedRichTextContent], [untrustedRichTextHtml, untrustedRichTextHtmlContent]] as const) {
      page.setData({ nodes })
      const tree = render()
      const rich = preview.querySelector('#structured')!
      const child = rich.querySelector<HTMLElement>('#untrusted-rich-child')!
      expect(child.tagName).toBe('P')
      expect(rich.textContent).toBe(expected)
      expect(await (await tree.$('#structured'))!.text()).toBe(expected)
      expect(child.getAttribute('title')).toBe('{{secret}}')
      expect(child.getAttribute('data-state')).toBe('{{secret}}')
      for (const attribute of ['onclick', 'bindtap', 'wx:for', 'wx:if', 'data-sim-tap', 'data-sim-scope', 'data-sim-node', 'data-sim-component']) {
        expect(child.hasAttribute(attribute)).toBe(false)
      }
      expect(rich.querySelectorAll('script, style, wxs, unsafe-card')).toHaveLength(0)
      expect(rich.querySelector('a')?.hasAttribute('href')).toBe(false)
      expect(rich.querySelector('img')?.hasAttribute('src')).toBe(false)
      expect(rich.querySelector('img')?.hasAttribute('onerror')).toBe(false)
      child.click()
      rich.querySelector('img')!.dispatchEvent(new Event('error'))
      expect(Reflect.get(globalThis, 'richTextExecuted')).toBeUndefined()
      await expect((await tree.getElementsByXpath('//*[@id="untrusted-rich-child"]'))[0]!.tap()).rejects.toThrow('No tap binding')
      expect(page.data.calls).toBe(0)
      expect(session.getApp()!.globalData.attached).toBe(0)
      await (await tree.$('#structured'))!.tap()
    }
    expect(page.data.outerTaps).toBe(2)

    for (const [nodes, expected] of [
      [[{ name: 'strong', children: [{ type: 'text', text: 'replacement <literal> &amp;' }] }], 'replacement <literal> &amp;'],
      ['<div>HTML &amp; replacement</div>', 'HTML & replacement'],
      [[], ''],
      [null, ''],
      ['', ''],
      [42, ''],
      ['<p>restored</p>', 'restored'],
    ] as const) {
      page.setData({ nodes })
      const tree = render()
      expect(preview.querySelector('#structured')?.textContent).toBe(expected)
      expect(await (await tree.$('#structured'))!.text()).toBe(expected)
    }
  }
  finally {
    session.close()
    preview.remove()
    Reflect.deleteProperty(globalThis, 'richTextExecuted')
  }
})

it('does not replace registered rich-text custom component templates with native rich text', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(richTextFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/custom/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#custom-content')?.textContent).toBe('custom:native content')
    page.setData({ nodes: [{ name: 'p', children: [{ text: 'updated' }] }] })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#custom-content')?.textContent).toBe('custom:updated')
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('keeps allowed rich-text links from navigating the real preview while preserving outer taps', async () => {
  const preview = document.createElement('div')
  preview.style.cssText = 'height: 1000px; width: 600px'
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
  const initialUrl = location.href
  try {
    workbench.loadSession('native-rich-links', createBrowserVirtualFiles(richTextFiles))
    const shadow = Array.from(preview.querySelectorAll('*')).find(element => element.shadowRoot)!.shadowRoot!
    const page = workbench.session.value!.getCurrentPages().at(-1)!
    const activations: Array<{ type: string, prevented: boolean, trusted: boolean }> = []
    const observe = (event: Event) => activations.push({
      type: event.type,
      prevented: event.defaultPrevented,
      trusted: event.isTrusted,
    })
    shadow.addEventListener('click', observe)
    shadow.addEventListener('auxclick', observe)
    let taps = 0
    for (const target of ['_self', '_blank']) {
      page.setData({ nodes: [{ name: 'a', attrs: { href: '#native-rich-test', target }, children: [{ text: 'Open native link' }] }] })
      await vi.waitFor(() => expect(shadow.querySelector('#structured a')?.getAttribute('target')).toBe(target))
      await browserPage.getByRole('link', { name: 'Open native link' }).click()
      expect(location.href).toBe(initialUrl)
      expect(activations.at(-1)).toEqual({ type: 'click', prevented: true, trusted: true })
      expect(page.data.outerTaps).toBe(++taps)
      await browserPage.getByRole('link', { name: 'Open native link' }).click({ button: 'middle' })
      expect(location.href).toBe(initialUrl)
      expect(activations.at(-1)).toEqual({ type: 'auxclick', prevented: true, trusted: true })
      expect(page.data.outerTaps).toBe(taps)
    }
    await browserPage.screenshot({
      element: preview,
      path: '../../../../docs/reports/simulator-browser/native-rich-links.png',
    })
  }
  finally {
    workbench.session.value?.close()
    app.unmount()
    preview.remove()
    history.replaceState(history.state, '', initialUrl)
  }
})
