import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { renderFailureFiles } from '../test/helpers/renderFailures'

it('settles failed render callbacks, reports original errors and recovers on an explicit browser update', async () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  const commitFailure = new Error('browser host commit failed')
  let rejectCommit = false
  const session = createBrowserHeadlessSession({
    files: createBrowserVirtualFiles(renderFailureFiles),
    onRender: async () => {
      if (rejectCommit) {
        throw commitFailure
      }
      preview.innerHTML = session.renderCurrentPage().wxml
    },
  })
  try {
    const page = session.reLaunch('/pages/index/index')
    const update = (patch: Record<string, unknown>) => new Promise<void>(resolve => page.setData(patch, resolve))
    await update({ count: 0 })
    expect(preview.querySelectorAll('.child')).toHaveLength(2)
    const parent = session.selectComponent('#parent')!
    const first = session.selectComponent('#first')!

    await update({ visible: false })
    expect(session.getDiagnostics()).toEqual([
      expect.objectContaining({ level: 'exception', args: [expect.objectContaining({ message: 'detached hook failed' })] }),
    ])
    expect(session.getApp().globalData.detached).toEqual(['first', 'second'])
    expect(session.getApp().globalData.callbacks).toEqual(['first', 'second'])
    expect(parent.getRelationNodes('../child/index')).toEqual([])
    expect(first.getRelationNodes('../parent/index')).toEqual([])
    expect(session.getScopeIdForComponent(first)).toBeNull()

    rejectCommit = true
    await update({ count: 1 })
    expect(session.getDiagnostics()).toEqual([
      expect.objectContaining({ level: 'exception', args: [expect.objectContaining({ message: 'detached hook failed' })] }),
      expect.objectContaining({ level: 'exception', args: [commitFailure] }),
    ])

    rejectCommit = false
    await update({ count: 2 })
    expect(preview.querySelector('#count')?.textContent).toBe('2')
    expect(preview.querySelectorAll('.child')).toHaveLength(0)
    expect(session.getApp().globalData.detached).toEqual(['first', 'second'])
    expect(session.getDiagnostics()).toHaveLength(2)
  }
  finally {
    session.getApp().globalData.throwOnDetach = false
    session.close()
    preview.remove()
  }
}, 10_000)
