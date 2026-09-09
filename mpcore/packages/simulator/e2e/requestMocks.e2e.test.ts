import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { requestMockFiles, requestResponseMock } from '../test/helpers/requestMocks'

describe('mock request browser DOM', () => {
  afterEach(() => vi.useRealTimers())

  function createPreview() {
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(requestMockFiles), strictHostMocks: true })
    const preview = document.createElement('div')
    document.body.append(preview)
    const page = session.reLaunch('/pages/index/index')
    return {
      page,
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

  it('replaces pending nodes with the mock response and ordered callbacks', async () => {
    vi.useFakeTimers()
    const fixture = createPreview()
    fixture.session.mockRequest(requestResponseMock)
    try {
      fixture.render()
      expect(fixture.preview.querySelector('#request-status')?.textContent).toBe('idle')
      expect(fixture.preview.querySelector('#socket-capability')?.textContent).toBe('undefined:false')
      fixture.page.request()
      fixture.render()
      expect(fixture.preview.querySelector('#request-pending')?.textContent).toBe('Waiting for response')
      expect(fixture.preview.querySelector('#request-result')).toBeNull()
      expect(fixture.preview.querySelectorAll('.request-callback')).toHaveLength(0)

      await vi.advanceTimersByTimeAsync(30)
      fixture.render()

      expect(fixture.preview.querySelector('#request-status')?.textContent).toBe('success')
      expect(fixture.preview.querySelector('#request-result')?.textContent).toBe('Dashboard ready')
      expect(fixture.preview.querySelector('#request-http-status')?.textContent).toBe('201')
      expect(fixture.preview.querySelector('#request-pending')).toBeNull()
      expect(fixture.preview.querySelector('#request-error')).toBeNull()
      expect(Array.from(fixture.preview.querySelectorAll('.request-callback'), node => node.textContent)).toEqual(['success', 'complete'])
    }
    finally {
      fixture.close()
    }
  })

  it('renders abort failure and never inserts response nodes afterward', async () => {
    vi.useFakeTimers()
    const fixture = createPreview()
    fixture.session.mockRequest(requestResponseMock)
    try {
      fixture.page.request()
      fixture.page.abort()
      await vi.advanceTimersByTimeAsync(60)
      fixture.render()

      expect(fixture.preview.querySelector('#request-error')?.textContent).toBe('request:fail abort')
      expect(fixture.preview.querySelector('#request-result')).toBeNull()
      expect(fixture.preview.querySelector('#request-pending')).toBeNull()
      expect(Array.from(fixture.preview.querySelectorAll('.request-callback'), node => node.textContent)).toEqual(['fail', 'complete'])
    }
    finally {
      fixture.close()
    }
  })

  it('renders strict unmatched request failure without success evidence', () => {
    const fixture = createPreview()
    try {
      fixture.page.request()
      fixture.render()

      expect(fixture.preview.querySelector('#request-status')?.textContent).toBe('error')
      expect(fixture.preview.querySelector('#request-error')?.textContent).toBe('No request mock matched in headless runtime: POST https://request-fixture.invalid/graphql')
      expect(fixture.preview.querySelector('#request-result')).toBeNull()
      expect(fixture.preview.querySelectorAll('.request-callback')).toHaveLength(0)
      expect(fixture.session.getRequestLogs()).toEqual([expect.objectContaining({ matched: false })])
    }
    finally {
      fixture.close()
    }
  })
})
