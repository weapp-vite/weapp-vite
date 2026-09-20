import { describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { logManagerFiles } from '../test/helpers/logManager'

describe('LogManager browser rendering', () => {
  it('renders the synchronous API result and records explicit warnings', () => {
    const warning = vi.spyOn(console, 'warn').mockImplementation(() => {})
    const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(logManagerFiles(1)) })
    const preview = document.createElement('div')
    document.body.append(preview)
    try {
      session.reLaunch('/pages/index/index')
      preview.innerHTML = session.renderCurrentPage().wxml
      expect(preview.querySelector('#log-state')?.textContent).toBe('sync:void')
      expect(preview.querySelector('#log-capability')?.textContent).toBe('true')
      expect(warning).toHaveBeenCalledExactlyOnceWith('probe:warn', { level: 'payload' })
      expect(session.getDiagnostics()).toEqual([
        { level: 'warn', args: ['probe:warn', { level: 'payload' }], timestamp: expect.any(Number) },
      ])
    }
    finally {
      session.close()
      preview.remove()
      warning.mockRestore()
    }
  })
})
