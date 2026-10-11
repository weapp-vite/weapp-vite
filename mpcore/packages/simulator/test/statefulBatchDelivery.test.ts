import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createStatefulBatchDeliveryFiles } from './helpers/statefulBatchDelivery'

it('reports only successfully executed versions and keeps the rendered batch after failure', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(createStatefulBatchDeliveryFiles()) })
  try {
    const page = session.reLaunch('/pages/index/index')
    page.publishBatch()
    expect(page.pendingTimers()).toEqual([2000])
    page.patch()
    expect(page.pendingTimers()).toEqual([])
    expect(session.renderCurrentPage().wxml).toContain('py-5_d5')
    expect(page.reports().at(-1)).toMatchObject({ action: 'poll', version: 1, payloads: ['app.js'] })
    page.publishBatch()
    expect(page.pendingTimers()).toEqual([2000])
    page.failPatch()
    expect(page.pendingTimers()).toEqual([])
    expect(page.reports().at(-1)).toMatchObject({ action: 'rebuild', version: 1, failure: { reason: 'patch-failed' } })
    expect(page.data.count).toBe(1)
    expect(session.getCurrentPages()[0]).toBe(page)
    page.stopClient()
    expect(page.pendingTimers()).toEqual([])
  }
  finally {
    session.close()
  }
})
