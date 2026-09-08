import type { PageStyleSource } from '../test/helpers/pageStyleImports'
import { expect, it } from 'vitest'
// eslint-disable-next-line wevu/no-unsupported-api -- 此处挂载浏览器 Vue 宿主，不进入小程序 Wevu 运行时。
import { createApp, defineComponent, h, nextTick, ref } from 'vue'
import DevicePreview from '../../../demos/web/src/components/DevicePreview.vue'
import { useWorkbenchSession } from '../../../demos/web/src/composables/useWorkbenchSession'
import { createBrowserVirtualFiles } from '../src/browser'
import { createPageStyleImportFiles, pageStyleGlobal, pageStylePage, pageStyleTemplate } from '../test/helpers/pageStyleImports'

function mountPageStyleWorkbench(source: PageStyleSource = 'imported', overrides: Array<[string, string]> = []) {
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
        onDispatchTapChain: workbench.handleDispatchTapChain,
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

it.each(['imported', 'inline'] as const)('mounts repeated %s WXSS and WXML updates through the real workbench preview without resetting state', async (source) => {
  const preview = mountPageStyleWorkbench(source)
  try {
    await nextTick()
    const session = preview.workbench.session.value!
    const page = session.getCurrentPages()[0]
    const app = session.getApp()
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor).toBe('rgb(219, 234, 254)')
    preview.element('#increment').click()
    await nextTick()
    expect(preview.element('#count').textContent).toBe('count: 1')

    for (const [name, color] of [
      ['rose', 'rgb(255, 228, 230)'],
      ['mint', 'rgb(209, 250, 229)'],
      ['violet', 'rgb(237, 233, 254)'],
      ['amber', 'rgb(254, 243, 199)'],
    ]) {
      preview.workbench.run(() => {
        session.files.set('styles/palette.wxss', pageStyleGlobal(name!, color!))
        session.files.set('pages/shared/index.wxml', pageStyleTemplate(name!))
        if (source === 'inline') {
          session.files.set('pages/shared/index.wxss', pageStylePage(source, name!, color!))
        }
      })
      await nextTick()
      const probe = preview.element('#import-probe')
      expect(probe.className).toBe(`tone-${name}`)
      expect(probe.textContent).toBe(name)
      expect(getComputedStyle(probe).backgroundColor).toBe(color)
      expect(getComputedStyle(preview.element('#local-probe')).backgroundColor).toBe('rgb(31, 41, 55)')
      expect(preview.element('#count').textContent).toBe('count: 1')
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }

    preview.workbench.run(() => {
      session.files.set('styles/palette.wxss', pageStyleGlobal('amber', 'rgb(254, 215, 170)'))
      if (source === 'inline') {
        session.files.set('pages/shared/index.wxss', pageStylePage(source, 'amber', 'rgb(254, 215, 170)'))
      }
    })
    await nextTick()
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor).toBe('rgb(254, 215, 170)')
    expect(getComputedStyle(preview.element('#local-probe')).backgroundColor).toBe('rgb(31, 41, 55)')
    expect(preview.element('#count').textContent).toBe('count: 1')
    expect(session.getCurrentPages()[0]).toBe(page)
    expect(session.getApp()).toBe(app)

    if (source === 'inline') {
      preview.workbench.run(() => session.files.set('pages/shared/index.wxss', pageStylePage(source, 'amber', 'rgb(165, 243, 252)')))
      await nextTick()
      expect(preview.element('#import-probe').className).toBe('tone-amber')
      expect(preview.element('#import-probe').textContent).toBe('amber')
      expect(getComputedStyle(preview.element('#import-probe')).backgroundColor).toBe('rgb(165, 243, 252)')
      expect(getComputedStyle(preview.element('#local-probe')).backgroundColor).toBe('rgb(31, 41, 55)')
      expect(preview.element('#count').textContent).toBe('count: 1')
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }
  }
  finally {
    preview.close()
  }
})

it('removes app styles when navigating to page-isolated and applies only its explicit imports and local styles', async () => {
  const preview = mountPageStyleWorkbench()
  try {
    await nextTick()
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor).toBe('rgb(219, 234, 254)')
    preview.workbench.handleOpenRoute('pages/isolated/index')
    await nextTick()
    expect(preview.element('#import-probe').className).toBe('tone-initial')
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(getComputedStyle(preview.element('#local-probe')).backgroundColor).toBe('rgb(31, 41, 55)')
    const session = preview.workbench.session.value!
    const page = session.getCurrentPages()[0]
    preview.element('#increment').click()
    await nextTick()

    preview.workbench.run(() => session.files.set('styles/palette.wxss', pageStyleGlobal('initial', 'rgb(254, 243, 199)')))
    await nextTick()
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor).toBe('rgba(0, 0, 0, 0)')
    expect(preview.element('#count').textContent).toBe('count: 1')

    preview.workbench.run(() => session.files.set('pages/isolated/index.wxss', '@import "../../styles/global.wxss"; .local-probe { background-color: rgb(31, 41, 55); }'))
    await nextTick()
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor).toBe('rgb(254, 243, 199)')
    expect(getComputedStyle(preview.element('#local-probe')).backgroundColor).toBe('rgb(31, 41, 55)')
    expect(preview.element('#count').textContent).toBe('count: 1')
    expect(session.getCurrentPages()[0]).toBe(page)
  }
  finally {
    preview.close()
  }
})

it.each([
  ['apply-shared', 'page-isolated', false],
  ['page-isolated', 'apply-shared', true],
  [undefined, 'page-isolated', false],
] as const)('renders JSON isolation %j / %j with app styles enabled=%j through the real preview', async (definitionIsolation, jsonIsolation, appWxssEnabled) => {
  const preview = mountPageStyleWorkbench('imported', [
    ['pages/shared/index.js', `Component({options:${JSON.stringify({ styleIsolation: definitionIsolation })},data:{count:0},methods:{increment(){this.setData({count:this.data.count+1})}}})`],
    ['pages/shared/index.json', JSON.stringify({ styleIsolation: jsonIsolation })],
    ['pages/shared/index.wxss', '.local-probe { background-color: rgb(31, 41, 55); }'],
  ])
  try {
    await nextTick()
    const session = preview.workbench.session.value!
    const page = session.getCurrentPages()[0]
    const app = session.getApp()
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor)
      .toBe(appWxssEnabled ? 'rgb(219, 234, 254)' : 'rgba(0, 0, 0, 0)')
    preview.element('#increment').click()
    await nextTick()
    preview.workbench.run(() => session.files.set('styles/palette.wxss', pageStyleGlobal('initial', 'rgb(254, 243, 199)')))
    await nextTick()
    expect(preview.element('#import-probe').className).toBe('tone-initial')
    expect(getComputedStyle(preview.element('#import-probe')).backgroundColor)
      .toBe(appWxssEnabled ? 'rgb(254, 243, 199)' : 'rgba(0, 0, 0, 0)')
    expect(getComputedStyle(preview.element('#local-probe')).backgroundColor).toBe('rgb(31, 41, 55)')
    expect(preview.element('#count').textContent).toBe('count: 1')
    expect(session.getCurrentPages()[0]).toBe(page)
    expect(session.getApp()).toBe(app)
  }
  finally {
    preview.close()
  }
})
