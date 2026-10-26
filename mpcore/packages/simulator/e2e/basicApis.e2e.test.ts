import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { basicApisFiles } from '../test/helpers/basicApis'

describe('issue #1264: browser basic wx APIs', () => {
  afterEach(() => vi.useRealTimers())

  function createPreview(strictHostMocks = false) {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(basicApisFiles()), strictHostMocks })
    const preview = document.createElement('div')
    document.body.append(preview)
    return {
      session,
      preview,
      render() {
        preview.innerHTML = session.renderCurrentPage().wxml
      },
      close() {
        session.close()
        preview.remove()
      },
    }
  }

  it('renders configured account information, binary conversion and an asynchronous login', async () => {
    vi.useFakeTimers()
    const fixture = createPreview()
    fixture.session.setAccountInfo({ miniProgram: { appId: 'wx-browser-account', envVersion: 'trial', version: '' } })
    fixture.session.mockLogin({ code: 'browser-code', delay: 20 })
    try {
      const page = fixture.session.reLaunch('/pages/index/index')
      page.readBasics()
      page.login()
      fixture.render()
      expect(fixture.preview.querySelector('#api-capability')?.textContent).toBe('true')
      expect(fixture.preview.querySelector('#account-id')?.textContent).toBe('wx-browser-account')
      expect(fixture.preview.querySelector('#account-env')?.textContent).toBe('trial')
      expect(fixture.preview.querySelector('#base64-encoded')?.textContent).toBe('AH+A/w==')
      expect(fixture.preview.querySelector('#base64-decoded')?.textContent).toBe('0,127,128,255')
      expect(fixture.preview.querySelector('#login-status')?.textContent).toBe('idle')
      expect(fixture.preview.querySelectorAll('.login-callback')).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(20)
      fixture.render()
      expect(fixture.preview.querySelector('#login-status')?.textContent).toBe('success')
      expect(fixture.preview.querySelector('#login-code')?.textContent).toBe('browser-code')
      expect(Array.from(fixture.preview.querySelectorAll('.login-callback'), node => node.textContent)).toEqual(['success', 'complete'])
      expect(fixture.session.getDiagnostics()).toEqual([])
    }
    finally {
      fixture.close()
    }
  })

  it('renders strict mock failure followed by an explicit login failure', async () => {
    vi.useFakeTimers()
    const fixture = createPreview(true)
    try {
      const page = fixture.session.reLaunch('/pages/index/index')
      page.login()
      await vi.advanceTimersByTimeAsync(0)
      fixture.render()
      expect(fixture.preview.querySelector('#login-error')?.textContent).toBe('login:fail no mock matched in headless runtime')
      expect(fixture.preview.querySelector('#login-code')?.textContent).toBe('')

      fixture.session.mockLogin({ error: 'denied' })
      page.login()
      await vi.advanceTimersByTimeAsync(0)
      fixture.render()
      expect(fixture.preview.querySelector('#login-status')?.textContent).toBe('error')
      expect(fixture.preview.querySelector('#login-error')?.textContent).toBe('login:fail denied')
      expect(Array.from(fixture.preview.querySelectorAll('.login-callback'), node => node.textContent)).toEqual(['fail', 'complete', 'fail', 'complete'])
    }
    finally {
      fixture.close()
    }
  })
})
