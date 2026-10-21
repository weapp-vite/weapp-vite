import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { compiledPageWithWxs, compiledTemplateEdits, compiledTemplateFiles, compiledTemplatePaths } from '../test/helpers/compiledTemplateRegistration'

it('keeps unregistered compiled changes invisible in browser DOM until host submission while native WXML stays live', () => {
  const files = createBrowserVirtualFiles(compiledTemplateFiles())
  const session = createBrowserHeadlessSession({ files, compiledTemplatePaths })
  const other = createBrowserHeadlessSession({ files, compiledTemplatePaths })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  const text = (selector: string) => preview.querySelector(selector)?.textContent
  try {
    const page = session.reLaunch('/pages/index/index')
    const app = session.getApp()
    render()
    const button = preview.querySelector('#increment')!
    session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, {})
    render()
    const component = session.selectComponent('#compiled')
    expect(text('#count')).toBe('count: 1')
    let previous = 'BASE'
    for (const marker of ['NEXT', 'BASE', 'LAST']) {
      for (const [file, source] of compiledTemplateEdits(marker)) {
        files.set(file, source)
      }
      render()
      expect(text('#title')).toBe(previous)
      expect(text('#included')).toBe(`INCLUDE-${previous}`)
      expect(text('#imported')).toBe(`IMPORT-${previous}:1`)
      expect(text('#compiled-title')).toBe(`COMPONENT-${previous}`)
      expect(text('#native-title')).toBe(`NATIVE-${marker}`)
      expect(session.reloadTemplates()).toBe(true)
      render()
      expect(text('#title')).toBe(marker)
      expect(text('#included')).toBe(`INCLUDE-${marker}`)
      expect(text('#imported')).toBe(`IMPORT-${marker}:1`)
      expect(text('#compiled-title')).toBe(`COMPONENT-${marker}`)
      expect(text('#count')).toBe('count: 1')
      expect(session.selectComponent('#compiled')).toBe(component)
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
      expect(session.reloadTemplates()).toBe(false)
      previous = marker
    }
    files.set('pages/index/index.wxml', '<view><include src="../../fragments/missing"/></view>')
    expect(() => session.reloadTemplates()).toThrow(/Missing compiled template/)
    render()
    expect(text('#title')).toBe('LAST')
    files.set('pages/index/index.wxml', '<view><include src="../../../outside"/></view>')
    expect(() => session.reloadTemplates()).toThrow(/Compiled template paths must stay inside/)
    render()
    expect(text('#title')).toBe('LAST')
    other.reLaunch('/pages/index/index')
    expect(other.renderCurrentPage().wxml).toContain('COMPONENT-BASE')
    session.close()
    expect(() => session.reloadTemplates()).toThrow(/closed/i)
  }
  finally {
    session.close()
    other.close()
    preview.remove()
  }
})

it('shares registered dependency versions with native consumers while native template files remain live', () => {
  const files = createBrowserVirtualFiles(compiledTemplateFiles())
  files.set('components/native/index.wxml', '<view><text id="native-title">NATIVE-BASE</text><include src="../../fragments/body"/></view>')
  const session = createBrowserHeadlessSession({ files, compiledTemplatePaths })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    session.reLaunch('/pages/index/index')
    files.set('components/native/index.wxml', '<view><text id="native-title">NATIVE-NEXT</text><include src="../../fragments/body"/></view>')
    files.set('fragments/body.wxml', '<text id="included">INCLUDE-NEXT</text>')
    render()
    expect(preview.querySelector('#native-title')?.textContent).toBe('NATIVE-NEXT')
    expect([...preview.querySelectorAll('#included')].map(node => node.textContent)).toEqual(['INCLUDE-BASE', 'INCLUDE-BASE'])
    expect(session.reloadTemplates()).toBe(true)
    render()
    expect([...preview.querySelectorAll('#included')].map(node => node.textContent)).toEqual(['INCLUDE-NEXT', 'INCLUDE-NEXT'])
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('renders inline WXS from the submitted A→B→A generation and retains its cache after failed submission', () => {
  const files = createBrowserVirtualFiles(compiledTemplateFiles())
  files.set('pages/index/index.wxml', compiledPageWithWxs())
  const session = createBrowserHeadlessSession({ files, compiledTemplatePaths })
  const preview = document.createElement('div')
  document.body.append(preview)
  const renderCalls = (marker: string) => {
    preview.innerHTML = session.renderCurrentPage().wxml
    return Number(new RegExp(`^WXS-${marker}:(\\d+)$`).exec(preview.querySelector('#wxs-registration')?.textContent ?? '')?.[1])
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(renderCalls('BASE')).toBeGreaterThan(0)
    for (const marker of ['NEXT', 'BASE']) {
      files.set('pages/index/index.wxml', compiledPageWithWxs(marker))
      expect(session.reloadTemplates()).toBe(true)
      expect(renderCalls(marker)).toBeGreaterThan(0)
      expect(session.getCurrentPages()[0]).toBe(page)
    }
    const beforeUnchanged = renderCalls('BASE')
    expect(session.reloadTemplates()).toBe(false)
    expect(renderCalls('BASE')).toBeGreaterThan(beforeUnchanged)
    files.set('pages/index/index.wxml', `${compiledPageWithWxs('INVALID')}<include src="../../fragments/missing"/>`)
    const beforeFailure = renderCalls('BASE')
    expect(() => session.reloadTemplates()).toThrow(/Missing compiled template/)
    expect(renderCalls('BASE')).toBeGreaterThan(beforeFailure)
  }
  finally {
    session.close()
    preview.remove()
  }
})
