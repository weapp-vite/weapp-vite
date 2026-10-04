import type { EditAction } from './driver'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import timers from 'node:timers/promises'
import { afterEach, beforeEach, expect, it, vi } from 'vitest'
import { writeFrameworkSequenceSources } from './frameworkSources'

vi.mock('../utils/atomicRename', async (importOriginal) => {
  const { renameAtomicFile } = await importOriginal<typeof import('../utils/atomicRename')>()
  return {
    renameAtomicFile: (...[source, destination, options]: Parameters<typeof renameAtomicFile>) => renameAtomicFile(source, destination, { ...options, platform: 'win32' }),
  }
})

const nativeRename = fs.rename
let root: string

beforeEach(async () => {
  root = await fs.mkdtemp(path.join(os.tmpdir(), 'framework-sequence-save-'))
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(root, { recursive: true, force: true })
})

it('keeps framework initial writes and edits as direct saves', async () => {
  const signal = new AbortController().signal
  const rename = vi.spyOn(fs, 'rename')
  const files = { 'main.js': 'initial' }
  await writeFrameworkSequenceSources(root, {}, { files, step: 0, signal })
  await writeFrameworkSequenceSources(root, files, { files: { 'main.js': 'edited' }, step: 1, action: { kind: 'write', file: 'main.js', content: 'edited' }, signal })
  expect(await fs.readFile(path.join(root, 'main.js'), 'utf8')).toBe('edited')
  expect(await fs.readdir(root)).toEqual(['main.js'])
  expect(rename).not.toHaveBeenCalled()
})

it.each(['rename', 'rapid'] as const)('retries framework %s without changing source bytes or mtime', async (kind) => {
  const files = { 'old.js': 'complete source' }
  const source = path.join(root, 'old.js')
  const destination = path.join(root, 'nested/new.js')
  await fs.writeFile(source, files['old.js'])
  const timestamp = new Date('2020-01-02T03:04:05.000Z')
  await fs.utimes(source, timestamp, timestamp)
  const action: EditAction = { kind: 'rename', file: 'old.js', to: 'nested/new.js' }
  const rename = vi.spyOn(fs, 'rename').mockRejectedValueOnce(Object.assign(new Error('Windows shared handle'), { code: 'EPERM' })).mockImplementation(nativeRename)
  const remove = vi.spyOn(fs, 'rm')
  const write = vi.spyOn(fs, 'writeFile')
  vi.spyOn(timers, 'setTimeout').mockImplementation(async () => {
    expect(await fs.readFile(source, 'utf8')).toBe('complete source')
    await expect(fs.stat(destination)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  await writeFrameworkSequenceSources(root, files, { files: { 'nested/new.js': 'complete source' }, step: 1, action: kind === 'rename' ? action : { kind, saves: [action] }, signal: new AbortController().signal })
  expect(rename.mock.calls).toEqual([[source, destination], [source, destination]])
  expect(await fs.readFile(destination, 'utf8')).toBe('complete source')
  expect((await fs.stat(destination)).mtimeMs).toBe(timestamp.getTime())
  expect(remove).not.toHaveBeenCalled()
  expect(write).not.toHaveBeenCalled()
})

it('cancels framework rename backoff with the original deadline and skips subsequent rapid edits', async () => {
  const files = { 'old.js': 'complete source' }
  await fs.writeFile(path.join(root, 'old.js'), files['old.js'])
  const controller = new AbortController()
  const reason = new DOMException('original sequence deadline', 'TimeoutError')
  const nativeWait = timers.setTimeout
  const rename = vi.spyOn(fs, 'rename').mockRejectedValue(Object.assign(new Error('Windows shared handle'), { code: 'EPERM' }))
  const wait = vi.spyOn(timers, 'setTimeout').mockImplementation((...args) => {
    const waiting = nativeWait(...args)
    controller.abort(reason)
    return waiting
  })
  const write = vi.spyOn(fs, 'writeFile')
  const action: EditAction = { kind: 'rapid', saves: [
    { kind: 'rename', file: 'old.js', to: 'new.js' },
    { kind: 'write', file: 'new.js', content: 'later edit' },
  ] }

  await expect(writeFrameworkSequenceSources(root, files, { files: { 'new.js': 'later edit' }, step: 1, action, signal: controller.signal })).rejects.toBe(reason)
  expect(rename).toHaveBeenCalledTimes(1)
  expect(wait).toHaveBeenCalledExactlyOnceWith(10, undefined, { signal: controller.signal })
  expect(write).not.toHaveBeenCalled()
  expect(await fs.readdir(root)).toEqual(['old.js'])
  expect(await fs.readFile(path.join(root, 'old.js'), 'utf8')).toBe('complete source')
  expect(files).toEqual({ 'old.js': 'complete source' })
})
