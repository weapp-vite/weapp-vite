import { Buffer } from 'node:buffer'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { cleanupTempDirs } from './helpers'
import { basicApisFiles } from './helpers/basicApis'
import { createBasicApisSession } from './helpers/basicApisSession'

describe('issue #1264: basic wx APIs', () => {
  const directories: string[] = []
  afterEach(() => {
    vi.useRealTimers()
    cleanupTempDirs(directories)
  })

  for (const provider of ['node', 'browser'] as const) {
    it(`provides all four methods to page scripts in ${provider}`, async () => {
      vi.useFakeTimers()
      const session = createBasicApisSession(provider, directories)
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(page.data.methods).toEqual(['function', 'function', 'function', 'function'])
        expect(page.data.capable).toBe(true)
        page.readBasics()
        expect(page.data).toMatchObject({
          account: { miniProgram: { appId: 'wx-basic-apis', envVersion: 'develop', version: '' } },
          encoded: 'AH+A/w==',
          decoded: [0, 127, 128, 255],
        })
        page.login()
        expect(page.data.loginReturn).toBe('undefined')
        expect(page.data.callbacks).toEqual([])
        await vi.runAllTimersAsync()
        expect(page.data.callbacks).toEqual(['success', 'complete'])
        expect(page.data.code).toBe('mpcore-login-1')
        expect(session.getDiagnostics()).toEqual([])
      }
      finally {
        session.close()
      }
    })

    it(`round-trips empty, padded and large binary buffers in ${provider}`, () => {
      const session = createBasicApisSession(provider, directories)
      try {
        const page = session.reLaunch('/pages/index/index')
        for (const bytes of [[], [0], [255, 254], [0, 1, 2], Array.from({ length: 65_537 }, (_, index) => index % 256)]) {
          const expected = Buffer.from(bytes).toString('base64')
          expect(page.encode(bytes)).toBe(expected)
          expect(page.decode(expected)).toEqual(bytes)
        }
      }
      finally {
        session.close()
      }
    })

    it.each(['wx-private', '  '])(`resolves private appid %j in ${provider}`, (appid) => {
      const entries = [...basicApisFiles(), ['project.private.config.json', JSON.stringify({ appid })] as [string, string]]
      const session = createBasicApisSession(provider, directories, entries)
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(page.account()).toEqual({
          miniProgram: { appId: appid.trim() || 'wx-basic-apis', envVersion: 'develop', version: '' },
        })
      }
      finally {
        session.close()
      }
    })

    it(`keeps missing appid empty and does not fabricate plugin information in ${provider}`, () => {
      const entries = basicApisFiles().map(([name, source]): [string, string] => [
        name,
        name === 'project.config.json' ? JSON.stringify({ miniprogramRoot: '.' }) : source,
      ])
      const session = createBasicApisSession(provider, directories, entries)
      try {
        const page = session.reLaunch('/pages/index/index')
        expect(page.account()).toEqual({ miniProgram: { appId: '', envVersion: 'develop', version: '' } })
      }
      finally {
        session.close()
      }
    })

    it(`isolates configured and returned account snapshots in ${provider}`, () => {
      const session = createBasicApisSession(provider, directories)
      const configured = { miniProgram: { appId: 'wx-configured', envVersion: 'release' as const, version: '2.3.4' } }
      session.setAccountInfo(configured)
      configured.miniProgram.appId = 'mutated-input'
      try {
        const page = session.reLaunch('/pages/index/index')
        const first = page.account()
        first.miniProgram.appId = 'mutated-output'
        expect(page.account()).toEqual({
          miniProgram: { appId: 'wx-configured', envVersion: 'release', version: '2.3.4' },
        })
      }
      finally {
        session.close()
      }
    })
  }
})
