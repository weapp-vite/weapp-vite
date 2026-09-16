import { afterEach, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { chunkedRequestFiles, chunkedRequestMock } from '../test/helpers/chunkedRequest'

afterEach(() => vi.useRealTimers())
it('renders partial bytes before completion and preserves cancellation in the browser runtime', async () => {
  vi.useFakeTimers()
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(chunkedRequestFiles) })
  const preview = document.createElement('div')
  document.body.append(preview)
  session.mockRequest(chunkedRequestMock())
  try {
    const page = session.reLaunch('/pages/index')
    page.start('normal')
    await vi.advanceTimersByTimeAsync(20)
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#status')?.textContent).toBe('streaming')
    expect(preview.querySelector('#bytes')?.textContent).toBe('2')
    page.abort()
    await vi.runAllTimersAsync()
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#status')?.textContent).toBe('completed')
    expect(preview.querySelector('#bytes')?.textContent).toBe('2')
    expect(page.data.events).toEqual(['headers', 'chunk', 'fail', 'complete'])
  }
  finally {
    session.close()
    preview.remove()
  }
})
