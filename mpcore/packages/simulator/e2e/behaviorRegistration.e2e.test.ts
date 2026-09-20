import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createBehaviorRegistrationFiles, validNestedBehavior } from '../test/helpers/behaviorRegistration'

it('renders the native registration error while preserving constructed behavior output', () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const files = createBehaviorRegistrationFiles(validNestedBehavior)
  const invalidPage = `
Page({ data: { error: '' } })
try {
  Component({ behaviors: [{ __WEAPP_VITE_I18N__: true }] })
}
catch (error) {
  getApp().registrationError = error.message
}
`
  files.push(['pages/invalid/index.js', invalidPage])
  files.push(['pages/invalid/index.wxml', '<text id="registration-error">{{error}}</text>'])
  files[0] = ['app.json', JSON.stringify({ pages: ['pages/index/index', 'pages/invalid/index'] })]
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
  try {
    const page = session.reLaunch('/pages/invalid/index')
    page.setData({ error: session.getApp()?.registrationError ?? 'missing native error' })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#registration-error')?.textContent).toBe('Behaviors should be constructed with Behavior()')
    expect(preview.querySelector('#behavior-result')).toBeNull()
    session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#behavior-result')?.textContent).toBe('constructed behavior')
    expect(preview.querySelector('#registration-error')).toBeNull()
  }
  finally {
    session.close()
    preview.remove()
  }
})
