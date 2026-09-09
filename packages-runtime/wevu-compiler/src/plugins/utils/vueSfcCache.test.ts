import { rename, utimes } from 'node:fs/promises'
import os from 'node:os'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import * as fs from '../../utils/fs'
import { clearFileCaches } from './cache'
import { readAndParseSfc } from './vueSfc'

describe('SFC descriptor cache identity', () => {
  let directory: string
  let filename: string
  const original = '<template><view>old</view></template><style>.page{color:red}</style>'
  const updated = '<template><view>new</view></template><style>.page{color:tan}</style>'

  beforeEach(async () => {
    clearFileCaches()
    directory = await fs.mkdtemp(path.join(os.tmpdir(), 'wevu-sfc-cache-'))
    filename = path.join(directory, 'component.vue')
    await fs.writeFile(filename, original)
  })

  afterEach(async () => {
    vi.restoreAllMocks()
    clearFileCaches()
    await fs.remove(directory)
  })

  it('refreshes a descriptor after atomic replacement preserves mtime and size', async () => {
    const timestamp = new Date('2024-01-01T00:00:00Z')
    await utimes(filename, timestamp, timestamp)
    const previousStats = await fs.stat(filename)
    const previous = await readAndParseSfc(filename)
    expect(previous.descriptor.styles[0].content).toBe('.page{color:red}')

    const replacement = path.join(directory, 'replacement.vue')
    await fs.writeFile(replacement, updated)
    await utimes(replacement, timestamp, timestamp)
    await rename(replacement, filename)
    const currentStats = await fs.stat(filename)
    expect(currentStats.mtimeMs).toBe(previousStats.mtimeMs)
    expect(currentStats.size).toBe(previousStats.size)
    expect(currentStats.ino).not.toBe(previousStats.ino)

    const current = await readAndParseSfc(filename)
    expect(current.source).toBe(updated)
    expect(current.descriptor.styles[0].content).toBe('.page{color:tan}')
    expect(current.descriptor.template?.content).toBe('<view>new</view>')
  })

  it('parses explicit source even when disk metadata still matches the previous descriptor', async () => {
    await readAndParseSfc(filename)
    const current = await readAndParseSfc(filename, { source: updated })
    expect(current.source).toBe(updated)
    expect(current.descriptor.template?.content).toBe('<view>new</view>')

    const disk = await readAndParseSfc(filename)
    expect(disk.source).toBe(original)
    expect(disk.descriptor.template?.content).toBe('<view>old</view>')
  })

  it('keys descriptors by preprocessed parser input', async () => {
    await readAndParseSfc(filename, { source: original, preprocessedSource: original })
    const current = await readAndParseSfc(filename, { source: original, preprocessedSource: updated })
    expect(current.source).toBe(original)
    expect(current.descriptor.template?.content).toBe('<view>new</view>')
  })

  it('keeps effective ignoreEmpty options in the parse cache identity', async () => {
    const source = '<template><view /></template><style></style>'
    const ignored = await readAndParseSfc(filename, { source, ignoreEmpty: true })
    expect(ignored.descriptor.styles).toHaveLength(0)
    const retained = await readAndParseSfc(filename, { source, ignoreEmpty: false })
    expect(retained.descriptor.styles).toHaveLength(1)
    const ignoredAgain = await readAndParseSfc(filename, { source, ignoreEmpty: true })
    expect(ignoredAgain.descriptor.styles).toHaveLength(0)
  })

  it('keeps each concurrent read paired with its own parsed source', async () => {
    const started = Promise.withResolvers<void>()
    const delayed = Promise.withResolvers<string>()
    vi.spyOn(fs, 'readFile').mockImplementationOnce(async () => {
      started.resolve()
      return await delayed.promise
    })
    const previous = readAndParseSfc(filename)
    await started.promise
    await fs.writeFile(filename, updated)
    const current = await readAndParseSfc(filename)
    expect(current.descriptor.template?.content).toBe('<view>new</view>')
    delayed.resolve(original)

    const captured = await previous
    expect(captured.source).toBe(original)
    expect(captured.descriptor.template?.content).toBe('<view>old</view>')
    const latest = await readAndParseSfc(filename)
    expect(latest.source).toBe(updated)
    expect(latest.descriptor.template?.content).toBe('<view>new</view>')
  })
})
