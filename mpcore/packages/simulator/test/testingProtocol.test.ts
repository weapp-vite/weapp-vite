import { afterEach, describe, expect, it, vi } from 'vitest'
import { createHeadlessSession } from '../src/runtime'
import { HeadlessTestingSessionHandle, launch } from '../src/testing'
import { cleanupTempDirs, createBaseFixture } from './helpers'

describe('headless automator protocol boundary', () => {
  const directories: string[] = []
  const handles: HeadlessTestingSessionHandle[] = []

  afterEach(async () => {
    await Promise.all(handles.splice(0).map(handle => handle.disconnect().catch(() => {})))
    cleanupTempDirs(directories)
  })

  function projectPath() {
    const root = createBaseFixture()
    directories.push(root)
    return root
  }

  it('returns the real page identity and wraps function and wx results in protocol responses', async () => {
    const handle = await launch({ projectPath: projectPath() })
    handles.push(handle)
    const page = await handle.reLaunch('/pages/index/index?source=protocol')
    const snapshot = { pageId: page.pageId, path: page.path, query: { source: 'protocol' } }
    await expect(handle.send('Tool.getInfo')).resolves.toEqual({ version: 'mpcore-simulator' })
    await expect(handle.send('App.getCurrentPage')).resolves.toEqual(snapshot)
    await expect(handle.send('App.getPageStack')).resolves.toEqual({ pageStack: [snapshot] })
    await expect(handle.send('App.callFunction', {
      functionDeclaration: '(value) => ({ doubled: value * 2 })',
      args: [4],
    })).resolves.toEqual({ result: { doubled: 8 } })
    await handle.send('App.callWxMethod', { method: 'setStorageSync', args: ['protocol', { value: 5 }] })
    await expect(handle.send('App.callWxMethod', { method: 'getStorageSync', args: ['protocol'] })).resolves.toEqual({ result: { value: 5 } })
  })

  it('rejects unknown methods and every CDP entry without inventing debugger results', async () => {
    const handle = await launch({ projectPath: projectPath() })
    handles.push(handle)
    for (const method of ['App.unknown', 'App.CDPEnable', 'App.CDPCommand', 'App.CDPListProtocol']) {
      await expect(handle.send(method)).rejects.toMatchObject({ code: 'HEADLESS_PROTOCOL_UNSUPPORTED', method })
    }
    const cdp = handle.CDP()
    await expect(cdp.enable()).rejects.toMatchObject({ code: 'HEADLESS_PROTOCOL_UNSUPPORTED', method: 'App.CDPEnable' })
    await expect(cdp.sendCommand('Runtime', 'getHeapUsage', {})).rejects.toMatchObject({ code: 'HEADLESS_PROTOCOL_UNSUPPORTED' })
    await expect(cdp.listProtocol()).rejects.toMatchObject({ code: 'HEADLESS_PROTOCOL_UNSUPPORTED' })
    expect(() => cdp.onEvent(vi.fn())).toThrow(expect.objectContaining({ code: 'HEADLESS_PROTOCOL_UNSUPPORTED', method: 'App.CDPEvent' }))
  })

  it('bounds protocol work and rejects pending work when the session closes', async () => {
    const handle = await launch({ projectPath: projectPath() })
    handles.push(handle)
    await expect(handle.send('App.callFunction', { functionDeclaration: '() => new Promise(() => {})' }, { timeout: 10 })).rejects.toThrow('Timed out executing protocol method App.callFunction')
    const pending = handle.send('App.callFunction', { functionDeclaration: '() => new Promise(() => {})' })
    const rejected = expect(pending).rejects.toThrow('closed before protocol method App.callFunction completed')
    await handle.disconnect()
    await rejected
  })

  it('validates protocol parameters before executing runtime code', async () => {
    const handle = await launch({ projectPath: projectPath() })
    handles.push(handle)
    await expect(handle.send('App.callFunction', { functionDeclaration: '' })).rejects.toThrow('functionDeclaration must be a non-empty string')
    await expect(handle.send('App.callWxMethod', { method: 'getStorageSync', args: {} })).rejects.toThrow('args must be an array')
  })

  it('starts teardown synchronously and shares concurrent and repeated disconnect results', async () => {
    const runtime = createHeadlessSession({ projectPath: projectPath() })
    const close = vi.spyOn(runtime, 'close')
    const handle = new HeadlessTestingSessionHandle(runtime.project, runtime)
    handles.push(handle)
    let reentrant: Promise<void> | undefined
    handle.on('close', () => {
      reentrant = handle.disconnect()
    })
    const first = handle.disconnect()
    expect(runtime.isClosed).toBe(true)
    expect(reentrant).toBe(first)
    expect(handle.disconnect()).toBe(first)
    expect(handle.close()).toBe(first)
    await first
    expect(close).toHaveBeenCalledOnce()
    await expect(handle.send('Tool.getInfo')).rejects.toThrow(/closed/i)
  })

  it('preserves the teardown failure for every disconnect caller', async () => {
    const runtime = createHeadlessSession({ projectPath: projectPath() })
    const handle = new HeadlessTestingSessionHandle(runtime.project, runtime)
    handles.push(handle)
    const failure = new Error('close listener failed')
    handle.on('close', () => {
      throw failure
    })
    const first = handle.disconnect()
    expect(runtime.isClosed).toBe(true)
    expect(handle.disconnect()).toBe(first)
    await expect(first).rejects.toBe(failure)
    await expect(handle.close()).rejects.toBe(failure)
  })
})
