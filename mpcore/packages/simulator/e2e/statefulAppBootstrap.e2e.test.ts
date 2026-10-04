// @ts-expect-error Node 侧生成真实 Wevu App 与 stateful banner，由浏览器消费。
import sources from 'virtual:stateful-app-bootstrap-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('boots App and page after each full stateful runtime replacement', () => {
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    for (let boot = 0; boot < 2; boot++) {
      const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
      try {
        session.reLaunch('/pages/index/index')
        preview.innerHTML = session.renderCurrentPage().wxml
        expect(preview.querySelector('#app-state')?.textContent).toBe('1')
        const app = session.getApp()
        session.reLaunch('/pages/index/index')
        expect(session.getApp()).toBe(app)
        expect(app?.launches).toBe(1)
      }
      finally {
        session.close()
      }
    }
  }
  finally {
    preview.remove()
  }
})

it('rejects an incomplete runtime before rendering from a fresh complete session', () => {
  const completeSources = sources as Array<[string, string]>
  const incompleteFiles = createBrowserVirtualFiles(completeSources)
  incompleteFiles.set('rolldown-runtime.js', '')
  const incompleteSession = createBrowserHeadlessSession({ files: incompleteFiles })
  try {
    expect(() => incompleteSession.reLaunch('/pages/index/index')).toThrow(/installNative/)
    expect(incompleteSession.getApp()).toBeNull()
    expect(incompleteSession.getCurrentPages()).toEqual([])
  }
  finally {
    incompleteSession.close()
  }
  expect(incompleteSession.isClosed).toBe(true)

  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(completeSources) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.reLaunch('/pages/index/index')
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#app-state')?.textContent).toBe('1')
    const app = session.getApp()
    expect(app?.launches).toBe(1)
    session.reLaunch('/pages/index/index')
    expect(session.getApp()).toBe(app)
    expect(app?.launches).toBe(1)
  }
  finally {
    session.close()
    preview.remove()
  }
  expect(session.isClosed).toBe(true)
})
