import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { componentExportFiles, componentExportSnapshot, createOwnerComponentExportFiles } from '../test/helpers/componentExport'

it('renders custom component exports through the browser session native selectors', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(componentExportFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    expect(page.inspect()).toEqual(componentExportSnapshot)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#result')?.textContent).toBe('exported')
    session.selectComponent('#exported')!.setData({ label: 'updated' })
    page.inspect()
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#result')?.textContent).toBe('updated')
  }
  finally {
    session.close()
    preview.remove()
  }
})

it.each(['direct', 'nested'] as const)('renders and invokes %s owner exports while preserving raw testing access', (behavior) => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createOwnerComponentExportFiles(behavior)) })
  const preview = document.createElement('div')
  document.body.append(preview)
  const render = () => {
    preview.innerHTML = session.renderCurrentPage().wxml
  }
  try {
    session.reLaunch('/pages/index/index')
    const rawOwner = session.selectComponent('#exported')!
    const probe = session.selectComponent('#exported-probe')!
    probe.inspectOwner()
    render()
    expect(preview.querySelector('#exported-probe .owner-label')?.textContent).toBe('filtered-owner')
    expect(preview.querySelector('#exported-probe .owner-keys')?.textContent).toBe('increment,label')
    expect(preview.querySelector('#exported-probe .owner-private')?.textContent).toBe('false')
    expect(preview.querySelector('#owner-count')?.textContent).toBe('0')

    const probeScopeId = session.getScopeIdForComponent(probe)!
    session.callTapBinding(probeScopeId, 'incrementOwner')
    render()
    expect(preview.querySelector('#owner-count')?.textContent).toBe('1')

    const rawBridgeOwner = session.selectOwnerComponent(probeScopeId)!
    expect(rawBridgeOwner).toBe(rawOwner)
    expect(rawBridgeOwner.data.secret).toBe('private owner state')
    rawBridgeOwner.privateIncrement()
    render()
    expect(preview.querySelector('#owner-count')?.textContent).toBe('2')

    const ordinaryOwner = session.selectComponent('#plain')!
    const ordinaryProbe = session.selectComponent('#plain-probe')!
    expect(ordinaryProbe.getOwner()).toBe(ordinaryOwner)
    expect(ordinaryProbe.getOwner().data.label).toBe('ordinary-owner')
    expect(rawOwner.selectOwnerComponent?.()).toBeNull()
  }
  finally {
    session.close()
    preview.remove()
  }
})
