import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from '../../utils/fs'
import { clearFileCaches, invalidateFileCache, isInvalidate, mtimeCache, readFile } from './cache'

describe('file cache concurrent publication', () => {
  let directory: string
  let filename: string

  beforeEach(async () => {
    clearFileCaches()
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-cache-publication-'))
    filename = path.join(directory, 'component.vue')
    await fs.writeFile(filename, 'previous source')
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    clearFileCaches()
    await fs.remove(directory)
  })

  function delayNextRead() {
    const started = Promise.withResolvers<void>()
    const read = Promise.withResolvers<string>()
    vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => {
      started.resolve()
      return await read.promise
    })
    return { started: started.promise, release: read.resolve }
  }

  it('does not treat a signature observation as a completed source refresh', async () => {
    expect(await readFile(filename)).toBe('previous source')
    await fs.writeFile(filename, 'current source with new signature')
    expect(await isInvalidate(filename)).toBe(true)
    expect(await readFile(filename)).toBe('current source with new signature')
  })

  it('retains public signature observation when reusing validated source content', async () => {
    await readFile(filename)
    mtimeCache.delete(filename)
    expect(await readFile(filename)).toBe('previous source')
    expect(await isInvalidate(filename)).toBe(false)
  })

  it('does not associate a new signature with cached content while its fresh read is pending', async () => {
    expect(await readFile(filename)).toBe('previous source')
    await fs.writeFile(filename, 'current source with new signature')
    const signature = await fs.stat(filename)
    vi.spyOn(fs, 'stat').mockResolvedValue(signature)
    const delayed = delayNextRead()
    const first = readFile(filename)
    await delayed.started
    const second = readFile(filename)
    await new Promise<void>(resolve => setImmediate(resolve))
    delayed.release('current source with new signature')

    expect(await first).toBe('current source with new signature')
    expect(await second).toBe('current source with new signature')
  })

  it('does not let an older read overwrite a newer completed source and signature', async () => {
    const delayed = delayNextRead()
    const previous = readFile(filename)
    await delayed.started
    await fs.writeFile(filename, 'current source with new signature')
    expect(await readFile(filename)).toBe('current source with new signature')
    delayed.release('previous source')
    expect(await previous).toBe('previous source')

    expect(await readFile(filename)).toBe('current source with new signature')
  })

  it.each([false, true])('does not repopulate invalidated caches from an in-flight read with checkMtime=%s', async (checkMtime) => {
    const delayed = delayNextRead()
    const previous = readFile(filename, { checkMtime })
    await delayed.started
    invalidateFileCache(filename)
    await fs.writeFile(filename, 'current source with new signature')
    delayed.release('previous source')
    await previous

    expect(await readFile(filename, { checkMtime: false })).toBe('current source with new signature')
  })

  it('revokes pending read publication when clearing all caches', async () => {
    const delayed = delayNextRead()
    const previous = readFile(filename)
    await delayed.started
    clearFileCaches()
    await fs.writeFile(filename, 'current source with new signature')
    delayed.release('previous source')
    await previous
    expect(await readFile(filename, { checkMtime: false })).toBe('current source with new signature')
  })
})
