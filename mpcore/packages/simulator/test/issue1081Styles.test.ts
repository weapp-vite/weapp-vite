import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { issue1081Styles } from './helpers/issue1081Styles'
import { createPageStyleImportFiles } from './helpers/pageStyleImports'

it('keeps page identity and event state when a compiled CSS Modules binding and stylesheet change together', () => {
  const files = createBrowserVirtualFiles([...createPageStyleImportFiles(), ...issue1081Styles])
  const session = createBrowserHeadlessSession({ files })
  try {
    const page = session.reLaunch('/pages/shared/index')
    const app = session.getApp()
    session.renderCurrentPage()
    session.callTapBinding(`page:${page.route}`, 'increment')
    page.setData({ moduleClass: 'panel_updated' })
    files.set('pages/shared/index.wxss', '.panel_updated { color: rgb(68, 85, 102); }')
    const rendered = session.renderCurrentPage()
    expect(rendered.wxml).toContain('class="panel_updated"')
    expect(rendered.wxml).toContain('count: 1')
    expect(rendered.styles.cssText).toContain('.panel_updated { color: rgb(68, 85, 102); }')
    expect(rendered.styles.cssText).not.toContain('panel_initial')
    session.callTapBinding(`page:${page.route}`, 'increment')
    expect(session.renderCurrentPage().wxml).toContain('count: 2')
    expect(session.getCurrentPages()[0]).toBe(page)
    expect(session.getApp()).toBe(app)
  }
  finally {
    session.close()
  }
})
