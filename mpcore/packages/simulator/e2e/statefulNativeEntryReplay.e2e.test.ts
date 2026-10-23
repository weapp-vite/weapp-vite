// @ts-expect-error Node 侧生成生产 CJS 入口，由浏览器真实 loader 消费同字节镜像。
import sources from 'virtual:stateful-native-entry-replay-fixture'
import { expect, it } from 'vitest'
import { createBrowserHeadlessSession, createBrowserVirtualFiles } from '../src/browser'

it('reports missing runtime capability before reexecuting the native entry with cached dependencies', () => {
  const entries = sources as Array<[string, string]>
  const files = createBrowserVirtualFiles(entries)
  expect(files.get('pages/index/index.replay.js')).toBe(files.get('pages/index/index.js'))
  const session = createBrowserHeadlessSession({ files })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index?source=browser-entry-replay')
    session.callScopeMethod(null, 'prepareReplay', {})
    session.callScopeMethod(null, 'removeReplayBridge', {})
    expect(() => session.callScopeMethod(null, 'replayNativeEntry', {})).not.toThrow()
    expect(() => session.callScopeMethod(null, 'replayNativeEntry', { again: true })).not.toThrow()
    const snapshot = session.callScopeMethod(null, 'replaySnapshot', {})
    expect(snapshot).toMatchObject({ bodyCount: 1, bridgePresent: false, version: 0, appLaunches: 1 })
    expect(snapshot.requests.filter((request: { action: string }) => request.action === 'rebuild')).toEqual([
      expect.objectContaining({ version: 0, failure: { reason: 'bridge-not-ready' } }),
    ])
    expect(session.getCurrentPages()).toEqual([page])
    expect(session.getCurrentPages()[0]).toBe(page)
    expect(page.options).toMatchObject({ source: 'browser-entry-replay' })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#replay-state')?.textContent).toBe('7|held-value|1')
    session.callScopeMethod(null, 'finishReplayFallback', {})
    expect(session.callScopeMethod(null, 'replaySnapshot', {})).toMatchObject({ phase: 'stopped', version: 0 })
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('keeps a native entry business failure visible without classifying it as unsupported', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  try {
    session.reLaunch('/pages/index/index')
    expect(() => session.callScopeMethod(null, 'replayBusinessFailure', {})).toThrow('native replay business failure')
    const snapshot = session.callScopeMethod(null, 'replaySnapshot', {})
    expect(snapshot).toMatchObject({ bodyCount: 2, bridgePresent: true, version: 0 })
    expect(snapshot.requests.filter((request: { action: string }) => request.action === 'rebuild')).toEqual([])
  }
  finally {
    session.close()
  }
})

it('holds classic replay outside a stopped stateful realm before using its incompatible cached facade', () => {
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles(sources as Array<[string, string]>) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index?source=browser-classic-handoff')
    session.callScopeMethod(null, 'prepareReplay', {})
    session.callScopeMethod(null, 'stopForClassicHandoff', {})
    const stoppedSnapshot = session.callScopeMethod(null, 'replaySnapshot', {})
    expect(stoppedSnapshot).toMatchObject({ clientPresent: true, phase: 'stopped', runtimeLoads: 1, cachedRuntimeExports: [] })
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
    expect(page.options).toMatchObject({ source: 'browser-classic-handoff' })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#replay-state')?.textContent).toBe('7|held-value|1')
    expect(() => session.callScopeMethod(null, 'replayUnprotectedClassicEntry', {})).toThrow('installWebRuntimeGlobals')
    expect(session.callScopeMethod(null, 'replaySnapshot', {})).toMatchObject({ classicPreludeCount: 1, classicBodyCount: 0 })
  }
  finally {
    session.close()
    preview.remove()
  }
})

it('executes the classic companion in a fresh realm with its interaction and business error intact', () => {
  const files = new Map(sources as Array<[string, string]>)
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
  const session = createBrowserHeadlessSession({ files: createBrowserVirtualFiles([...files]) })
  const preview = document.createElement('div')
  document.body.append(preview)
  try {
    const page = session.reLaunch('/pages/index/index?source=browser-fresh-classic')
    expect(page.data).toMatchObject({ count: 0, input: 'classic-value', launches: 1 })
    session.callScopeMethod(null, 'incrementClassic', {})
    expect(page.data.count).toBe(2)
    expect(page.options).toMatchObject({ source: 'browser-fresh-classic' })
    preview.innerHTML = session.renderCurrentPage().wxml
    expect(preview.querySelector('#replay-state')?.textContent).toBe('2|classic-value|1')
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
    session.close()
    preview.remove()
  }
})
