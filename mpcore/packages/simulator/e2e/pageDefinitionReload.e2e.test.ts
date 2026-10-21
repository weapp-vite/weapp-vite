import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { pageDefinitionFiles, pageDefinitionSource } from '../test/helpers/pageDefinitionReload'

it.each(['page', 'component'] as const)('selectively updates a %s definition and recovers failed candidates in the browser', (registration) => {
  const files = createBrowserVirtualFiles(pageDefinitionFiles(registration))
  const session = createBrowserHeadlessSession({ files })
  const other = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
    return preview.querySelector('.marker')?.textContent
  }
  const route = '/pages/index/index'
  try {
    const page = session.reLaunch(route)
    const app = session.getApp()
    const shared = page.shared()
    page.increment()
    other.reLaunch(route)
    expect(render()).toBe('BASE:1')
    files.set('pages/index/index.js', pageDefinitionSource('NEXT', registration))
    expect(session.reLaunch(route).data.marker).toBe('BASE')
    expect(session.reloadPageDefinition(route)).toBe(true)
    expect(render()).toBe('BASE:1')
    expect(session.reLaunch(route).shared()).toBe(shared)
    expect(render()).toBe('NEXT:1')
    expect(other.reLaunch(route).data).toMatchObject({ marker: 'BASE', count: 0 })

    for (const source of ['Page({', 'Page({});Page({})']) {
      files.set('pages/index/index.js', source)
      expect(() => session.reloadPageDefinition(route)).toThrow()
      session.reLaunch(route)
      expect(render()).toBe('NEXT:1')
    }
    files.set('pages/index/index.js', pageDefinitionSource('BASE', registration))
    expect(session.reloadPageDefinition(route)).toBe(true)
    expect(session.reLaunch(route).shared()).toBe(shared)
    expect(render()).toBe('BASE:1')
    expect(session.reloadPageDefinition(route)).toBe(false)
    expect(session.getApp()).toBe(app)
    expect(app?.dependencyLoads).toBe(1)
  }
  finally {
    session.close()
    other.close()
    preview.remove()
  }
})
