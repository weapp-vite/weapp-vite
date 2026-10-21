import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { templateIncludeFiles, templateIncludeLeaf } from '../test/helpers/templateIncludes'

it.each(['page', 'component'] as const)('renders nested includes and their component bindings through the %s browser scope', (registration) => {
  const files = createBrowserVirtualFiles(templateIncludeFiles(registration))
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    const page = session.reLaunch('/pages/index/index')
    const app = session.getApp()
    const owner = registration === 'page' ? page : session.selectComponent('#container')!
    render()
    expect([...preview.querySelectorAll('.included-leaf')].map(node => node.textContent)).toEqual(['INIT:BASE:0:caller-wxs', 'INIT:BASE:0:caller-wxs'])
    expect(preview.querySelector('.caller-template')?.textContent).toBe('caller-template')
    expect(preview.querySelector('.excluded-template')).toBeNull()
    expect(session.getApp()?.includedMarker).toBe('BASE')
    owner.increment()
    owner.update('UPDATED')
    for (const marker of ['EDIT', 'INIT', 'LATER', 'INIT']) {
      files.set('shared/includes/nested/leaf.wxml', templateIncludeLeaf(marker))
      render()
      expect([...preview.querySelectorAll('.included-leaf')].map(node => node.textContent)).toEqual([`${marker}:UPDATED:1:caller-wxs`, `${marker}:UPDATED:1:caller-wxs`])
      expect([...preview.querySelectorAll('.included-probe')].map(node => node.textContent)).toEqual(['UPDATED', 'UPDATED'])
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
      if (registration === 'component') {
        expect(session.selectComponent('#container')).toBe(owner)
      }
    }
    expect(session.getDiagnostics()).toEqual([])
  }
  finally {
    session.close()
    preview.remove()
  }
})

it.each(['page', 'component'] as const)('observes %s template changes before checking the browser component storage probe', async (registration) => {
  const files = createBrowserVirtualFiles(templateIncludeFiles(registration))
  const source = (marker: string) => templateIncludeLeaf(marker).replace('marker="{{label}}"', `marker="${marker}"`)
  files.set('shared/includes/nested/leaf.wxml', source('BASE'))
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    const app = session.getApp()
    const owner = registration === 'page' ? page : session.selectComponent('#container')!
    await new Promise<void>(resolve => owner.setData({ count: 1 }, resolve))
    for (const marker of ['NEXT', 'BASE']) {
      files.set('shared/includes/nested/leaf.wxml', source(marker))
      expect(session.getStorageSnapshot()['included-probe']).toBe(marker === 'NEXT' ? 'BASE' : 'NEXT')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('.included-leaf')?.textContent).toBe(`${marker}:BASE:1:caller-wxs`)
      expect(session.getStorageSnapshot()['included-probe']).toBe(marker)
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(session.getApp()).toBe(app)
      expect(owner.data.count).toBe(1)
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
