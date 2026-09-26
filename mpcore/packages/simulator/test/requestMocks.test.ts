import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { requestMockFiles, requestResponseMock } from './helpers/requestMocks'

describe('mock request rendering contract', () => {
  const directories: string[] = []
  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
    cleanupTempDirs(directories)
  })

  for (const provider of ['node', 'browser'] as const) {
    function createSession(strictHostMocks = true) {
      if (provider === 'browser') {
        return createBrowserHeadlessSession({ files: createBrowserVirtualFiles(requestMockFiles), strictHostMocks })
      }
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-request-mocks-'))
      directories.push(projectPath)
      for (const [file, source] of requestMockFiles) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      return createHeadlessSession({ projectPath, strictHostMocks })
    }

    it(`renders a delayed mock response and preserves request semantics in ${provider}`, async () => {
      vi.useFakeTimers()
      const outboundFetch = vi.spyOn(globalThis, 'fetch')
      const session = createSession()
      session.mockRequest(requestResponseMock)
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(page.data.socket).toBe('undefined:false')
        page.request()
        expect(session.renderCurrentPage().wxml).toContain('Waiting for response')
        expect(page.data.callbacks).toEqual([])

        await vi.advanceTimersByTimeAsync(30)

        const rendered = session.renderCurrentPage().wxml
        expect(rendered).toContain('Dashboard ready')
        expect(rendered).toContain('201')
        expect(rendered).not.toContain('Waiting for response')
        expect(page.data.callbacks).toEqual(['success', 'complete'])
        expect(session.getRequestLogs()).toEqual([expect.objectContaining({
          matched: true,
          method: 'POST',
          url: 'https://request-fixture.invalid/graphql',
          header: { 'content-type': 'application/json', 'x-client': 'fixture' },
          data: { operationName: 'Dashboard', variables: { section: 'overview' } },
          response: expect.objectContaining({ data: { message: 'Dashboard ready' }, statusCode: 201 }),
        })])
        expect(outboundFetch).not.toHaveBeenCalled()
      }
      finally {
        session.close()
      }
    })

    it(`renders cancellation without a late success in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createSession()
      session.mockRequest(requestResponseMock)
      try {
        const page = session.reLaunch('/pages/index/index')
        page.request()
        page.abort()
        await vi.advanceTimersByTimeAsync(60)
        expect(page.data.callbacks).toEqual(['fail', 'complete'])
        expect(session.renderCurrentPage().wxml).toContain('request:fail abort')
        expect(session.renderCurrentPage().wxml).not.toContain('Dashboard ready')
        expect(session.getRequestLogs()).toEqual([])
      }
      finally {
        session.close()
      }
    })

    it.each([true, false])(`renders an unmatched request with strictMocks=%s in ${provider}`, (strictHostMocks) => {
      const outboundFetch = vi.spyOn(globalThis, 'fetch')
      const session = createSession(strictHostMocks)
      try {
        const page = session.reLaunch('/pages/index/index')
        page.request()
        expect(page.data.status).toBe('error')
        expect(page.data.callbacks).toEqual(strictHostMocks ? [] : ['fail', 'complete'])
        expect(session.renderCurrentPage().wxml).toContain('No request mock matched in headless runtime: POST https://request-fixture.invalid/graphql')
        expect(session.getRequestLogs()).toEqual([expect.objectContaining({ matched: false, method: 'POST' })])
        expect(outboundFetch).not.toHaveBeenCalled()
      }
      finally {
        session.close()
      }
    })
  }
})
