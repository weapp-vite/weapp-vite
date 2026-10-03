import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { externalCssVarsFiles, externalCssVarsSteps } from './helpers/externalCssVars'
import { createPageStyleImportFiles } from './helpers/pageStyleImports'

it('preserves registration and events through all external CSS variable removal and restoration steps', () => {
  const files = createBrowserVirtualFiles([...createPageStyleImportFiles(), ...externalCssVarsFiles])
  const session = createBrowserHeadlessSession({ files })
  try {
    const page = session.reLaunch('/pages/shared/index')
    const app = session.getApp()
    session.renderCurrentPage()
    session.callTapBinding(`page:${page.route}`, 'increment')
    for (const step of externalCssVarsSteps) {
      files.set('pages/shared/index.wxss', `@import "../../styles/${step.file}.wxss";`)
      files.set(`styles/${step.file}.wxss`, `#external-vars { ${step.css}; }`)
      page.setData({ vars: step.vars, state: step.id })
      const rendered = session.renderCurrentPage()
      expect(rendered.wxml).toContain(`>${step.id}</view>`)
      expect(rendered.wxml).toContain(`style="${step.vars}"`)
      expect(rendered.styles.cssText).toContain(step.css)
      expect(page.data.count).toBe(1)
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
    }
    session.callTapBinding(`page:${page.route}`, 'increment')
    expect(page.data.count).toBe(2)
  }
  finally {
    session.close()
  }
})
