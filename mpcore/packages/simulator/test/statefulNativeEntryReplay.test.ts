import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import path from 'node:path'
import { describe, expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'
import { createHeadlessSession } from '../src/runtime'
import { createStatefulNativeEntryReplayFiles } from './helpers/statefulNativeEntryReplay'

describe.each(['node', 'browser'] as const)('%s native stateful entry replay', (provider) => {
  async function createFixture(mode: 'stateful' | 'classic' = 'stateful') {
    const sources = await createStatefulNativeEntryReplayFiles()
    const files = new Map(sources)
    expect(files.get('pages/index/index.replay.js')).toBe(files.get('pages/index/index.js'))
    expect(files.get('pages/index/index.replay-again.js')).toBe(files.get('pages/index/index.js'))
    if (mode === 'classic') {
      for (const [target, source] of [
        ['app.js', 'app.classic.js'],
        ['pages/index/index.js', 'pages/index/index.classic.js'],
        ['request-globals-runtime.js', 'request-globals-runtime.classic.js'],
      ] as const) {
        const code = files.get(source)
        if (code === undefined) {
          throw new Error(`Missing classic replay fixture: ${source}`)
        }
        files.set(target, code)
      }
    }
    const entries = [...files]
    const directory = await mkdtemp(path.join(tmpdir(), 'native-entry-replay-'))
    try {
      if (provider === 'node') {
        for (const [file, source] of entries) {
          const target = path.join(directory, file)
          await mkdir(path.dirname(target), { recursive: true })
          await writeFile(target, source)
        }
      }
      const session = provider === 'node'
        ? createHeadlessSession({ projectPath: directory })
        : createBrowserHeadlessSession({ files: createBrowserVirtualFiles(entries) })
      return {
        session,
        async close() {
          session.close()
          await rm(directory, { recursive: true, force: true })
        },
      }
    }
    catch (error) {
      await rm(directory, { recursive: true, force: true })
      throw error
    }
  }

  it('reports missing capability before replaying a cached-dependency entry and retains the current page', async () => {
    const fixture = await createFixture()
    const { session } = fixture
    try {
      const page = session.reLaunch('/pages/index/index?source=entry-replay')
      session.callScopeMethod(null, 'prepareReplay', {})
      expect(session.callScopeMethod(null, 'replaySnapshot', {})).toMatchObject({ bodyCount: 1, version: 0, phase: 'polling', appLaunches: 1 })
      expect(session.callScopeMethod(null, 'removeReplayBridge', {})).toBe(true)
      expect(() => session.callScopeMethod(null, 'replayNativeEntry', {})).not.toThrow()
      expect(() => session.callScopeMethod(null, 'replayNativeEntry', { again: true })).not.toThrow()
      const snapshot = session.callScopeMethod(null, 'replaySnapshot', {})
      expect(snapshot).toMatchObject({ bodyCount: 1, bridgePresent: false, version: 0, appLaunches: 1 })
      expect(snapshot.requests.filter((request: { action: string }) => request.action === 'rebuild')).toEqual([
        expect.objectContaining({ version: 0, action: 'rebuild', failure: { reason: 'bridge-not-ready' } }),
      ])
      expect(session.getCurrentPages()).toEqual([page])
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(page.data).toMatchObject({ count: 7, input: 'held-value', launches: 1 })
      expect(page.options).toMatchObject({ source: 'entry-replay' })
      expect(session.renderCurrentPage().wxml).toContain('>7|held-value|1</view>')
      session.callScopeMethod(null, 'finishReplayFallback', {})
      expect(session.callScopeMethod(null, 'replaySnapshot', {})).toMatchObject({ phase: 'stopped', version: 0 })
    }
    finally {
      await fixture.close()
    }
  })

  it('preserves an application error as an error without requesting a capability fallback', async () => {
    const fixture = await createFixture()
    const { session } = fixture
    try {
      session.reLaunch('/pages/index/index')
      expect(() => session.callScopeMethod(null, 'replayBusinessFailure', {})).toThrow('native replay business failure')
      const snapshot = session.callScopeMethod(null, 'replaySnapshot', {})
      expect(snapshot).toMatchObject({ bodyCount: 2, bridgePresent: true, version: 0 })
      expect(snapshot.requests.filter((request: { action: string }) => request.action === 'rebuild')).toEqual([])
    }
    finally {
      await fixture.close()
    }
  })

  it('holds classic entries outside a stopped stateful realm with an incompatible cached facade', async () => {
    const fixture = await createFixture()
    const { session } = fixture
    try {
      const page = session.reLaunch('/pages/index/index?source=classic-handoff')
      session.callScopeMethod(null, 'prepareReplay', {})
      session.callScopeMethod(null, 'stopForClassicHandoff', {})
      const stoppedSnapshot = session.callScopeMethod(null, 'replaySnapshot', {})
      expect(stoppedSnapshot).toMatchObject({
        clientPresent: true,
        phase: 'stopped',
        runtimeLoads: 1,
        cachedRuntimeExports: [],
      })
      expect(() => session.callScopeMethod(null, 'replayClassicEntry', {})).not.toThrow()
      expect(() => session.callScopeMethod(null, 'replayClassicEntry', { again: true })).not.toThrow()
      expect(() => session.callScopeMethod(null, 'replayClassicApp', {})).not.toThrow()
      expect(session.callScopeMethod(null, 'replaySnapshot', {})).toMatchObject({
        bodyCount: 1,
        classicPreludeCount: 0,
        classicBodyCount: 0,
        classicAppBodyCount: 0,
        runtimeLoads: 1,
        appLaunches: 1,
        requests: stoppedSnapshot.requests,
      })
      expect(session.getCurrentPages()[0]).toBe(page)
      expect(page.data).toMatchObject({ count: 7, input: 'held-value', launches: 1 })
      expect(page.options).toMatchObject({ source: 'classic-handoff' })
      expect(session.renderCurrentPage().wxml).toContain('>7|held-value|1</view>')
      expect(() => session.callScopeMethod(null, 'replayUnprotectedClassicEntry', {})).toThrow('installWebRuntimeGlobals')
      expect(session.callScopeMethod(null, 'replaySnapshot', {})).toMatchObject({ classicPreludeCount: 1, classicBodyCount: 0 })
    }
    finally {
      await fixture.close()
    }
  })

  it('starts the classic companion in a fresh realm and preserves its business exception', async () => {
    const fixture = await createFixture('classic')
    const { session } = fixture
    try {
      const page = session.reLaunch('/pages/index/index?source=fresh-classic')
      expect(page.data).toMatchObject({ count: 0, input: 'classic-value', launches: 1 })
      session.callScopeMethod(null, 'incrementClassic', {})
      expect(page.data.count).toBe(2)
      expect(page.options).toMatchObject({ source: 'fresh-classic' })
      expect(session.renderCurrentPage().wxml).toContain('>2|classic-value|1</view>')
      expect(session.callScopeMethod(null, 'classicReplaySnapshot', {})).toEqual({
        clientPresent: false,
        preludeCount: 1,
        bodyCount: 1,
        appBodyCount: 1,
        runtimeLoads: 1,
        runtimeInstalls: 1,
      })
      expect(() => session.callScopeMethod(null, 'replayClassicBusinessFailure', {})).toThrow('classic replay business failure')
      expect(session.callScopeMethod(null, 'classicReplaySnapshot', {})).toMatchObject({ clientPresent: false, bodyCount: 2 })
      expect(session.getCurrentPages()[0]).toBe(page)
    }
    finally {
      await fixture.close()
    }
  })
})
