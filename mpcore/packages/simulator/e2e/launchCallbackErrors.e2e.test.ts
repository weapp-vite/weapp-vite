import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createLaunchCallbackErrorFixture, launchCallbackErrorCases } from '../test/helpers/launchCallbackErrors'

it.each(launchCallbackErrorCases)('renders launch $method after its $callback callback throws', async ({ method, callback }) => {
  const fixture = createLaunchCallbackErrorFixture(method, callback)
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(fixture.files) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    session.reLaunch('/pages/home/index')
    const data = session.getApp()!.globalData
    expect(data.callbacks).toEqual(fixture.expectedCallbacks)
    expect(data.events).toEqual(fixture.committedEvents)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#launch-callback-page')?.textContent).toBe(fixture.targetPage)
    await expect.poll(() => data.events).toEqual([...fixture.committedEvents, fixture.readyEvent])
    await expect.poll(() => session.getDiagnostics()).toHaveLength(1)
    expect(session.getDiagnostics()[0]!.level).toBe('exception')
    expect(session.getDiagnostics()[0]!.args[0]).toBe(data.callbackError)
    expect(data.callbackError.message).toBe(fixture.errorMessage)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#launch-callback-page')?.textContent).toBe(fixture.targetPage)
    expect(preview.querySelector('#launch-callback-trace')?.textContent).toBe(fixture.expectedCallbacks.join('|'))
    expect(preview.querySelector('#launch-callback-complete-count')?.textContent).toBe('1')
    expect(session.getCurrentPages().map(page => page.route)).toEqual([`pages/${fixture.targetPage}/index`])
    expect(data.loads).toEqual(callback === 'fail' ? ['home'] : ['home', 'login'])
    expect(data.launchCalls).toBe(1)
    expect(data.callbacks).toEqual(fixture.expectedCallbacks)
    if (callback !== 'fail') {
      expect(data.navigationError).toBeUndefined()
    }
  }
  finally {
    session.close()
    preview.remove()
  }
})
