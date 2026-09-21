import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { nativePageStyleSlotFiles, nativeSlotStyles, nativeSlotTemplate } from './helpers/nativePageStyleSlots'

it('keeps native Page and slot interaction state across new global selectors and their restoration', () => {
  const files = createBrowserVirtualFiles(nativePageStyleSlotFiles())
  const session = createBrowserHeadlessSession({ files })
  try {
    const page = session.reLaunch('/pages/shared/index')
    const app = session.getApp()
    session.renderCurrentPage()
    page.toggle()
    for (const [name, color] of [['updated', '#10b981'], ['initial', '#f3f4f6']]) {
      const styles = nativeSlotStyles(name!, color!)
      files.set('global.wxss', styles)
      files.set('pages/shared/index.wxss', `${styles} #probe { height:100px; }`)
      files.set('pages/shared/index.wxml', nativeSlotTemplate(name!))
      const rendered = session.renderCurrentPage()
      expect(rendered.wxml).toContain(`data-color="${name}"`)
      expect(rendered.wxml).toContain('class="dark"')
      expect(rendered.styles.cssText).toContain(styles)
      page.toggle()
      expect(session.renderCurrentPage().wxml).toContain(`class="${name}"`)
      page.toggle()
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }
    expect(page.data.count).toBe(5)
  }
  finally {
    session.close()
  }
})
