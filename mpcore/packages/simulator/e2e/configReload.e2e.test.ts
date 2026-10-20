import type { BrowserHeadlessSession } from '../src/browser'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { getPageInstanceId } from '../src/runtime/pageInstance'
import { configReloadReadyLifecycle, configReloadRoute, configReloadTitles, createConfigReloadAppJson, createConfigReloadFiles } from '../test/helpers/configReload'

it('renders config round trips in fresh containers without replacing another browser session', async () => {
  const sessions: BrowserHeadlessSession[] = []
  const files = createBrowserVirtualFiles(createConfigReloadFiles())
  const host = document.createElement('div')
  const preview = document.createElement('div')
  const survivorPreview = document.createElement('div')
  host.append(preview, survivorPreview)
  document.body.append(host)
  async function start(sourceFiles = files) {
    const session = createBrowserHeadlessSession({ files: sourceFiles })
    sessions.push(session)
    const page = session.reLaunch(configReloadRoute)
    await expect.poll(() => page.data.ready).toBe(true)
    return { session, page, app: session.getApp()! }
  }
  function render(session: BrowserHeadlessSession, target: HTMLElement) {
    target.innerHTML = session.renderCurrentPage().wxml
  }
  function tap(session: BrowserHeadlessSession, target: HTMLElement) {
    render(session, target)
    const button = target.querySelector('#increment')!
    session.callScopeMethod(button.getAttribute('data-sim-scope')!, button.getAttribute('data-sim-tap')!, { type: 'tap' })
    render(session, target)
  }

  try {
    const survivor = await start(createBrowserVirtualFiles(createConfigReloadFiles()))
    survivor.app.__e2eHmrInstanceMarker = 'survivor-app'
    survivor.page.__e2eHmrInstanceMarker = 'survivor-page'
    tap(survivor.session, survivorPreview)
    let previous: Awaited<ReturnType<typeof start>> | undefined
    for (const [index, title] of configReloadTitles.entries()) {
      if (previous) {
        // 只显式替换容器，不把文件保存或旧容器 reLaunch 伪装为 IDE 自动重载。
        files.set('app.json', createConfigReloadAppJson(title))
        expect(previous.session.getCurrentPageNavigationBarTitle()).toBe(configReloadTitles[index - 1])
        expect(previous.page.data.count).toBe(1)
        render(previous.session, preview)
        const button = preview.querySelector('#increment')!
        const scopeId = button.getAttribute('data-sim-scope')!
        const method = button.getAttribute('data-sim-tap')!
        previous.session.close()
        previous.session.close()
        expect(previous.session.isClosed).toBe(true)
        expect(previous.app.globalData.lifecycle).toEqual([...configReloadReadyLifecycle, 'page:unload'])
        expect(() => previous!.session.getCurrentPages()).toThrow(/closed/i)
        expect(() => previous!.session.renderCurrentPage()).toThrow(/closed/i)
        expect(() => previous!.session.callScopeMethod(scopeId, method, { type: 'tap' })).toThrow(/closed/i)
      }
      const current = await start()
      const pageId = getPageInstanceId(current.page)
      render(current.session, preview)
      expect(current.page.route).toBe(configReloadRoute.slice(1))
      expect(current.app.globalData.lifecycle).toEqual(configReloadReadyLifecycle)
      expect(current.session.getCurrentPageNavigationBarTitle()).toBe(title)
      expect(preview.querySelector('#title')?.textContent).toBe(title)
      expect(preview.querySelector('#ready')?.textContent).toBe('true')
      expect(preview.querySelector('#increment')?.textContent).toBe('0')
      expect(current.app.__e2eHmrInstanceMarker).toBeUndefined()
      expect(current.page.__e2eHmrInstanceMarker).toBeUndefined()
      if (previous) {
        expect(current.app).not.toBe(previous.app)
        expect(current.page).not.toBe(previous.page)
        expect(pageId).not.toBe(getPageInstanceId(previous.page))
        expect(() => previous!.session.getCurrentPages()).toThrow(/closed/i)
        expect(() => previous!.session.renderCurrentPage()).toThrow(/closed/i)
      }
      current.app.__e2eHmrInstanceMarker = `app-${index}`
      current.page.__e2eHmrInstanceMarker = `page-${index}`
      tap(current.session, preview)
      expect(preview.querySelector('#increment')?.textContent).toBe('1')
      expect(current.session.getApp()).toBe(current.app)
      expect(current.session.getCurrentPages()).toEqual([current.page])
      expect(getPageInstanceId(current.page)).toBe(pageId)

      expect(survivor.session.getApp()).toBe(survivor.app)
      expect(survivor.session.getCurrentPages()).toEqual([survivor.page])
      expect(survivor.app.__e2eHmrInstanceMarker).toBe('survivor-app')
      expect(survivor.page.__e2eHmrInstanceMarker).toBe('survivor-page')
      expect(survivor.app.globalData.lifecycle).toEqual(configReloadReadyLifecycle)
      expect(survivor.session.getCurrentPageNavigationBarTitle()).toBe(configReloadTitles[0])
      render(survivor.session, survivorPreview)
      expect(survivorPreview.querySelector('#increment')?.textContent).toBe(String(index + 1))
      tap(survivor.session, survivorPreview)
      expect(survivorPreview.querySelector('#increment')?.textContent).toBe(String(index + 2))
      expect(current.session.getDiagnostics()).toEqual([])
      previous = current
    }
    expect([...files]).toEqual(createConfigReloadFiles())
  }
  finally {
    for (const session of sessions) {
      session.close()
    }
    host.remove()
  }
})
