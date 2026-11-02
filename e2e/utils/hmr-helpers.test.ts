import { mkdtemp, rm, writeFile } from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { fs } from '@weapp-core/shared/node'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { waitForEmittedJson } from './emittedJson'
import { parseStatefulHmrControlSource, waitForStatefulHmrControl } from './hmr-helpers'

function createControlSource(url: string) {
  return `globalThis["__WEAPP_VITE_STATEFUL_HMR_CONTROL__"] = ${JSON.stringify({
    buildId: 'build-id',
    token: 'token',
    url,
  })};\nvoid 0;\n`
}

describe('parseStatefulHmrControlSource', () => {
  it('waits for the listening port instead of accepting the initial zero-port publication', async () => {
    const endpoint = 'http://localhost:5173/__weapp_vite_stateful_hmr__'
    const exists = vi.spyOn(fs, 'pathExists').mockResolvedValue(true)
    const read = vi.spyOn(fs, 'readFile')
      .mockResolvedValueOnce(createControlSource('http://localhost:0/__weapp_vite_stateful_hmr__'))
      .mockResolvedValue(createControlSource(endpoint))
    try {
      await expect(waitForStatefulHmrControl('control.js', 2_000)).resolves.toEqual({ url: endpoint })
      expect(read).toHaveBeenCalledTimes(2)
    }
    finally {
      read.mockRestore()
      exists.mockRestore()
    }
  })

  it.each([
    'http://localhost:5173/__weapp_vite_stateful_hmr__',
    'http://127.0.0.1:5173/__weapp_vite_stateful_hmr__',
    'http://[::1]:5173/__weapp_vite_stateful_hmr__',
  ])('accepts a loopback control URL: %s', (url) => {
    expect(parseStatefulHmrControlSource(createControlSource(url))).toEqual({ url })
  })

  it.each([
    'https://localhost:5173/__weapp_vite_stateful_hmr__',
    'http://example.com:5173/__weapp_vite_stateful_hmr__',
    'http://localhost/__weapp_vite_stateful_hmr__',
    'http://localhost:0/__weapp_vite_stateful_hmr__',
    'http://127.0.0.1:0/__weapp_vite_stateful_hmr__',
    'http://localhost:5173/__weapp_vite_stateful_hmr__/',
    'http://localhost:5173/other',
  ])('rejects an invalid control URL: %s', (url) => {
    expect(parseStatefulHmrControlSource(createControlSource(url))).toBeUndefined()
  })

  it('rejects malformed control source', () => {
    expect(parseStatefulHmrControlSource('globalThis.control = {};')).toBeUndefined()
    expect(parseStatefulHmrControlSource('globalThis["__WEAPP_VITE_STATEFUL_HMR_CONTROL__"] = nope;')).toBeUndefined()
  })
})

describe('emitted JSON polling during bundler writes', () => {
  const directories: string[] = []
  const expected = { pages: ['pages/recreated/index'], window: { navigationBarTitleText: 'updated-title' } }
  const condition = 'pages to contain the recreated route'
  const matches = (value: unknown) => !!value && typeof value === 'object' && 'pages' in value
    && Array.isArray(value.pages) && value.pages.includes(expected.pages[0])

  async function fixture(source?: string) {
    const directory = await mkdtemp(path.join(os.tmpdir(), 'emitted-json-'))
    directories.push(directory)
    const file = path.join(directory, 'app.json')
    if (source !== undefined) {
      await writeFile(file, source)
    }
    return file
  }

  function publishAfterEachRead(file: string, sources: string[], observedErrors: unknown[] = []) {
    const original = fs.readJson
    return vi.spyOn(fs, 'readJson').mockImplementation(async (...args) => {
      try {
        return await original(...args)
      }
      catch (error) {
        observedErrors.push(error)
        throw error
      }
      finally {
        const source = sources.shift()
        if (source !== undefined) {
          await writeFile(file, source)
        }
      }
    })
  }

  afterEach(async () => {
    vi.restoreAllMocks()
    await Promise.all(directories.splice(0).map(directory => rm(directory, { recursive: true, force: true })))
  })

  it.each(['', '{"pages":['])('retries an actual incomplete JSON file %j until the complete output is published', async (source) => {
    const file = await fixture(source)
    const observedErrors: unknown[] = []
    const read = publishAfterEachRead(file, [JSON.stringify(expected)], observedErrors)
    await expect(waitForEmittedJson(file, matches, { condition, timeoutMs: 2_000, intervalMs: 1 })).resolves.toEqual(expected)
    expect(observedErrors).toHaveLength(1)
    expect(observedErrors[0]).toBeInstanceOf(SyntaxError)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('retries an actual missing file until the output is published', async () => {
    const file = await fixture()
    const observedErrors: unknown[] = []
    const read = publishAfterEachRead(file, [JSON.stringify(expected)], observedErrors)
    await expect(waitForEmittedJson(file, matches, { condition, timeoutMs: 2_000, intervalMs: 1 })).resolves.toEqual(expected)
    expect(observedErrors[0]).toMatchObject({ code: 'ENOENT' })
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('continues polling valid JSON until the requested title is present', async () => {
    const file = await fixture(JSON.stringify({ window: { navigationBarTitleText: 'original-title' } }))
    const read = publishAfterEachRead(file, [JSON.stringify(expected)])
    await expect(waitForEmittedJson(file, (value) => {
      const app = value as { window?: { navigationBarTitleText?: unknown } }
      return app.window?.navigationBarTitleText === expected.window.navigationBarTitleText
    }, { condition: 'window title to update', timeoutMs: 2_000, intervalMs: 1 })).resolves.toEqual(expected)
    expect(read).toHaveBeenCalledTimes(2)
  })

  it('keeps persistent malformed JSON failing at the deadline with its last parse error', async () => {
    const file = await fixture('{"pages":[')
    const read = vi.spyOn(fs, 'readJson')
    // 文件仍实际读取；虚拟时钟只固定截止点，避免依赖各平台文件系统延迟。
    vi.spyOn(performance, 'now').mockImplementation(() => read.mock.calls.length >= 2 ? 30 : 0)
    const error: unknown = await waitForEmittedJson(file, matches, { condition, timeoutMs: 30, intervalMs: 1 }).catch(error => error)
    expect(performance.now()).toBeGreaterThanOrEqual(30)
    expect(read).toHaveBeenCalledTimes(2)
    expect(error).toBeInstanceOf(Error)
    const failure = error as Error
    expect(failure.message).toContain('Timed out waiting for JSON app.json')
    expect(failure.cause).toBeInstanceOf(SyntaxError)
    expect(failure.message).toContain((failure.cause as Error).message)
  })

  it('reports the latest unmet condition after a parse failure has cleared', async () => {
    const file = await fixture('')
    publishAfterEachRead(file, [JSON.stringify({ pages: [] })])
    const clock = vi.spyOn(performance, 'now').mockReturnValue(0)
    const error: unknown = await waitForEmittedJson(file, (value) => {
      clock.mockReturnValue(50)
      return matches(value)
    }, { condition, timeoutMs: 50, intervalMs: 1 }).catch(error => error)
    expect(error).toBeInstanceOf(Error)
    const failure = error as Error
    expect(failure.cause).toBeInstanceOf(Error)
    expect(failure.cause).not.toBeInstanceOf(SyntaxError)
    expect(failure.message).toContain(`Latest valid JSON does not satisfy condition: ${condition}`)
  })

  it.each(['EACCES', 'EIO'])('immediately rejects a non-transient %s read error', async (code) => {
    const file = await fixture(JSON.stringify(expected))
    const error = Object.assign(new Error('Read failed'), { code })
    const read = vi.spyOn(fs, 'readJson').mockRejectedValue(error)
    await expect(waitForEmittedJson(file, matches, { condition, timeoutMs: 2_000, intervalMs: 1 })).rejects.toBe(error)
    expect(read).toHaveBeenCalledTimes(1)
  })

  it('does not retry a SyntaxError thrown by the condition itself', async () => {
    const file = await fixture(JSON.stringify(expected))
    const read = vi.spyOn(fs, 'readJson')
    const error = new SyntaxError('Invalid condition implementation')
    await expect(waitForEmittedJson(file, () => {
      throw error
    }, { condition, timeoutMs: 2_000, intervalMs: 1 })).rejects.toBe(error)
    expect(read).toHaveBeenCalledTimes(1)
  })
})
