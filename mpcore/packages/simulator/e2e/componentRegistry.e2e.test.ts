import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { registryConfig, registryFiles, registryPageConfig, registryRoute } from '../test/helpers/componentRegistry'

it('refreshes component config between renders while preserving independent sibling properties and slots', () => {
  const files = createBrowserVirtualFiles(registryFiles())
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch(registryRoute)
    page.setData({ show: true })
    for (const marker of ['A', 'B', 'A']) {
      files.set(registryPageConfig, registryConfig(`registry-${marker.toLowerCase()}`))
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#left .value')?.textContent).toBe(`${marker}:left:true`)
      expect(preview.querySelector('#right .value')?.textContent).toBe(`${marker}:right:true`)
      expect(preview.querySelector('#left .slot')?.textContent).toBe('left slot')
      expect(preview.querySelector('#right .slot')?.textContent).toBe('right slot')
      expect(session.getCurrentPages()[0]).toBe(page)
    }
    const left = session.selectComponent('#left')!
    const right = session.selectComponent('#right')!
    expect(left).not.toBe(right)
    left.setData({ ready: false })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#left .value')?.textContent).toBe('A:left:false')
    expect(preview.querySelector('#right .value')?.textContent).toBe('A:right:true')
  }
  finally {
    session.close()
    preview.remove()
  }
})
