import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { behaviorPropertyDeliveryFiles } from '../test/helpers/behaviorPropertyDelivery'
import { initialPropertyDeliveryFiles } from '../test/helpers/initialPropertyDelivery'
import { assertPropertyDeliveryEvents } from '../test/helpers/propertyDeliveryAssertions'

it('preserves native shared property data and avoids same-value property observer reentry', async () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(initialPropertyDeliveryFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    const render = () => {
      preview.innerHTML = session.renderCurrentPage().wxml
    }
    render()
    expect(preview.querySelector('.component-value')?.textContent).toBe('OWNER:SLOT-READY')
    assertPropertyDeliveryEvents(session.getApp()!.globalData.propertyEvents, 'initial')
    page.updateBoth()
    render()
    expect(preview.querySelector('.component-value')?.textContent).toBe('OWNER-UPDATED:SLOT-UPDATED')
    assertPropertyDeliveryEvents(session.getApp()!.globalData.propertyEvents, 'updated')
    await page.writeSelf()
    render()
    expect(preview.querySelector('.probe-value')?.textContent).toBe('OWNER-UPDATED:SLOT-UPDATED')
    expect(preview.querySelector('.component-value')?.textContent).toBe('SELF-CHANGED:SLOT-UPDATED')
    assertPropertyDeliveryEvents(session.getApp()!.globalData.propertyEvents, 'self-written')
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('delivers inherited properties before attached regardless of component method names', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(behaviorPropertyDeliveryFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('.inherited-value')?.textContent).toBe('OWNER:OWNER')
    page.updateFirst()
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('.inherited-value')?.textContent).toBe('OWNER-UPDATED:OWNER')
    expect(page.selectComponent!('#probe').properties).not.toHaveProperty('extra')
  }
  finally {
    session.close()
    preview.remove()
  }
})
