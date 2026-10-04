import type { EditAction } from './driver'
import fs from 'node:fs/promises'
import os from 'node:os'
import timers from 'node:timers/promises'
import path from 'pathe'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { SequenceSourceWriter } from './buildSources'

vi.mock('../utils/atomicRename', async (importOriginal) => {
  const { renameAtomicFile } = await importOriginal<typeof import('../utils/atomicRename')>()
  return {
    renameAtomicFile: (...[source, destination, options]: Parameters<typeof renameAtomicFile>) => renameAtomicFile(source, destination, { ...options, platform: 'win32' }),
  }
})

const nativeRename = fs.rename
let root: string
let writer: SequenceSourceWriter
const noteSourceWrite = vi.fn<(file: string) => void>()
const fileTimestamp = new Date('2020-01-02T03:04:05.000Z')

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'edit-sequence-save-'))
  writer = new SequenceSourceWriter(root, noteSourceWrite)
  noteSourceWrite.mockClear()
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(root, { recursive: true, force: true })
})

async function initialize(files: Record<string, string>) {
  await writer.write({ files, step: 0, signal: new AbortController().signal }, { started: false, fileTimestamp })
  noteSourceWrite.mockClear()
}

describe('sequence source publication', () => {
  it('retries the same pending file while preserving mtime and one source revision', async () => {
    await initialize({ 'main.js': 'old source' })
    const target = path.join(root, 'main.js')
    const pending = `${target}.pending`
    const timestamp = new Date(fileTimestamp.getTime() + 10_000)
    const locked = Object.assign(new Error('Windows shared handle'), { code: 'EPERM' })
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(locked).mockRejectedValueOnce(locked).mockImplementation(nativeRename)
    vi.spyOn(timers, 'setTimeout').mockImplementation(async () => {
      expect(await fs.readFile(target, 'utf8')).toBe('old source')
      expect((await fs.stat(target)).mtimeMs).toBe(fileTimestamp.getTime())
      expect(await fs.readFile(pending, 'utf8')).toBe('complete new source')
      expect((await fs.stat(pending)).mtimeMs).toBe(timestamp.getTime())
      expect(noteSourceWrite.mock.calls).toEqual([['main.js']])
    })

    await writer.write({ files: { 'main.js': 'complete new source' }, step: 1, signal: new AbortController().signal }, { started: true, fileTimestamp: timestamp })
    expect(rename.mock.calls).toEqual(Array.from({ length: 3 }, () => [pending, target]))
    expect(await fs.readFile(target, 'utf8')).toBe('complete new source')
    expect((await fs.stat(target)).mtimeMs).toBe(timestamp.getTime())
    expect(await fs.readdir(root)).toEqual(['main.js'])
    expect(writer.files).toEqual({ 'main.js': 'complete new source' })
    expect(noteSourceWrite.mock.calls).toEqual([['main.js']])
  })

  it.each(['rename', 'rapid'] as const)('retries a %s action without copying, removing, or rewriting its source', async (kind) => {
    await initialize({ 'old.js': 'complete source' })
    const source = path.join(root, 'old.js')
    const destination = path.join(root, 'nested/new.js')
    const action: EditAction = { kind: 'rename', file: 'old.js', to: 'nested/new.js' }
    const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('Windows shared handle'), { code: 'EACCES' })).mockImplementation(nativeRename)
    const remove = vi.spyOn(fs, 'rm')
    const write = vi.spyOn(fs, 'writeFile')
    vi.spyOn(timers, 'setTimeout').mockImplementation(async () => {
      expect(await fs.readFile(source, 'utf8')).toBe('complete source')
      await expect(fs.stat(destination)).rejects.toMatchObject({ code: 'ENOENT' })
    })
    const afterSave = vi.fn(async () => {})

    await writer.write({ files: { 'nested/new.js': 'complete source' }, step: 1, action: kind === 'rename' ? action : { kind, saves: [action] }, signal: new AbortController().signal }, { started: true, afterSave })
    expect(rename.mock.calls).toEqual([[source, destination], [source, destination]])
    expect(remove).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect((await fs.stat(destination)).mtimeMs).toBe(fileTimestamp.getTime())
    expect(noteSourceWrite.mock.calls).toEqual([['old.js'], ['nested/new.js']])
    expect(writer.files).toEqual({ 'nested/new.js': 'complete source' })
    expect(afterSave).toHaveBeenCalledTimes(kind === 'rapid' ? 1 : 0)
  })

  it('does not touch files or revisions when the sequence is already cancelled', async () => {
    await initialize({ 'main.js': 'old source' })
    const reason = new Error('cancel before save')
    const rename = vi.spyOn(fs, 'rename')
    const remove = vi.spyOn(fs, 'rm')
    const write = vi.spyOn(fs, 'writeFile')
    await expect(writer.write({ files: { 'other.js': 'new source' }, step: 1, signal: AbortSignal.abort(reason) }, { started: true })).rejects.toBe(reason)
    expect(rename).not.toHaveBeenCalled()
    expect(remove).not.toHaveBeenCalled()
    expect(write).not.toHaveBeenCalled()
    expect(noteSourceWrite).not.toHaveBeenCalled()
    expect(writer.files).toEqual({ 'main.js': 'old source' })
  })

  it('uses the original deadline to stop backoff, clean only pending content, and skip later saves', async () => {
    await initialize({ 'main.js': 'old source', 'later.js': 'later old source' })
    const controller = new AbortController()
    const reason = new DOMException('original sequence deadline', 'TimeoutError')
    const nativeWait = timers.setTimeout
    const rename = vi.spyOn(fs, 'rename').mockRejectedValue(Object.assign(new Error('Windows shared handle'), { code: 'EPERM' }))
    const remove = vi.spyOn(fs, 'rm')
    const wait = vi.spyOn(timers, 'setTimeout').mockImplementation((...args) => {
      const waiting = nativeWait(...args)
      controller.abort(reason)
      return waiting
    })

    await expect(writer.write({ files: { 'main.js': 'new source', 'later.js': 'later new source' }, step: 1, signal: controller.signal }, { started: true })).rejects.toBe(reason)
    expect(rename).toHaveBeenCalledTimes(1)
    expect(wait).toHaveBeenCalledExactlyOnceWith(10, undefined, { signal: controller.signal })
    expect(remove).toHaveBeenCalledExactlyOnceWith(path.join(root, 'main.js.pending'), { force: true })
    expect(await fs.readFile(path.join(root, 'main.js'), 'utf8')).toBe('old source')
    expect(await fs.readFile(path.join(root, 'later.js'), 'utf8')).toBe('later old source')
    expect((await fs.readdir(root)).sort()).toEqual(['later.js', 'main.js'])
    expect(noteSourceWrite.mock.calls).toEqual([['main.js']])
    expect(writer.files).toEqual({ 'main.js': 'old source', 'later.js': 'later old source' })
  })

  it('stops a rapid sequence when its original signal aborts after the first save', async () => {
    await initialize({ 'main.js': 'old source' })
    const controller = new AbortController()
    const reason = new Error('cancel between rapid saves')
    const action: EditAction = { kind: 'rapid', saves: [
      { kind: 'write', file: 'main.js', content: 'intermediate' },
      { kind: 'rename', file: 'main.js', to: 'new.js' },
    ] }
    const afterSave = vi.fn(async () => controller.abort(reason))
    const rename = vi.spyOn(fs, 'rename')

    await expect(writer.write({ files: { 'new.js': 'intermediate' }, step: 1, action, signal: controller.signal }, { started: true, afterSave })).rejects.toBe(reason)
    expect(afterSave).toHaveBeenCalledExactlyOnceWith({ 'main.js': 'intermediate' })
    expect(rename).toHaveBeenCalledTimes(1)
    expect(await fs.readdir(root)).toEqual(['main.js'])
    expect(await fs.readFile(path.join(root, 'main.js'), 'utf8')).toBe('intermediate')
    expect(writer.files).toEqual({ 'main.js': 'intermediate' })
    expect(noteSourceWrite.mock.calls).toEqual([['main.js']])
  })

  it('does not publish the same bytes already on the shared baseline source path', async () => {
    await fs.writeFile(path.join(root, 'main.js'), 'already present')
    const rename = vi.spyOn(fs, 'rename')
    await writer.write({ files: { 'main.js': 'already present' }, step: 0, signal: new AbortController().signal }, { started: false })
    expect(rename).not.toHaveBeenCalled()
    expect(noteSourceWrite).not.toHaveBeenCalled()
    expect(writer.files).toEqual({ 'main.js': 'already present' })
  })
})
