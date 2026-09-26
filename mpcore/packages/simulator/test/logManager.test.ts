import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { cleanupTempDirs } from './helpers'
import { logManagerFiles } from './helpers/logManager'

describe('synchronous LogManager', () => {
  const directories: string[] = []
  afterEach(() => {
    cleanupTempDirs(directories)
    vi.restoreAllMocks()
  })

  for (const provider of ['node', 'browser'] as const) {
    it.each([undefined, 0, 1])(`keeps explicit logs at level %s in ${provider}`, (level) => {
      const sinks = {
        debug: vi.spyOn(console, 'debug').mockImplementation(() => {}),
        info: vi.spyOn(console, 'info').mockImplementation(() => {}),
        log: vi.spyOn(console, 'log').mockImplementation(() => {}),
        warn: vi.spyOn(console, 'warn').mockImplementation(() => {}),
      }
      const files = logManagerFiles(level)
      const projectPath = fs.mkdtempSync(path.join(os.tmpdir(), 'mpcore-log-manager-'))
      directories.push(projectPath)
      for (const [file, source] of files) {
        const target = path.join(projectPath, file)
        fs.mkdirSync(path.dirname(target), { recursive: true })
        fs.writeFileSync(target, source)
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(files) })
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(page.data).toEqual({ state: 'sync:void', capable: true })
        for (const method of ['debug', 'info', 'log', 'warn'] as const) {
          expect(sinks[method]).toHaveBeenCalledExactlyOnceWith(`probe:${method}`, { level: 'payload' })
        }
        expect(session.getDiagnostics()).toEqual([
          { level: 'warn', args: ['probe:warn', { level: 'payload' }], timestamp: expect.any(Number) },
        ])
        expect(session.renderCurrentPage().wxml).toContain('sync:void')
      }
      finally {
        session.close()
      }
    })
  }
})
