import type { ManagedWechatProjectRecord } from '../types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readManagedWechatProjectRecords, writeManagedRecord } from '../journal'
import { createManagedChildJournal, initializeManagedJournalScope, resolveManagedJournalScope } from './scope'

let directory: string
let root: string
let controller: AbortController
let reason: Error

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-journal-read-cancel-'))
  root = await fs.mkdtemp(path.join(directory, 'task-scope-'))
  await initializeManagedJournalScope(root)
  controller = new AbortController()
  reason = new Error('Journal read cancelled by its owner')
})

afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

async function record(journalPath: string): Promise<ManagedWechatProjectRecord> {
  const id = randomUUID()
  const now = new Date().toISOString()
  const value: ManagedWechatProjectRecord = {
    schemaVersion: 1,
    id,
    generation: id,
    journalPath,
    ownerToken: randomUUID(),
    ownerPid: process.pid,
    target: {
      cliPath: path.join(directory, 'test-cli'),
      installationId: 'test-installation',
      appPath: path.join(directory, 'test-app'),
      profileDir: path.join(directory, 'test-profile'),
    },
    projectPath: path.join(journalPath, 'test-project'),
    state: 'released',
    releasedReason: 'not-started',
    createdAt: now,
    updatedAt: now,
  }
  await writeManagedRecord(value)
  return value
}

function abortAfterFileRead(file: string) {
  const original = fs.readFile
  return vi.spyOn(fs, 'readFile').mockImplementation((async (...args: Parameters<typeof fs.readFile>) => {
    const content = await Reflect.apply(original, fs, args)
    if (String(args[0]) === file) {
      // 在异步读取返回调用方之前取消，验证即使底层已取得内容也不能继续遍历。
      controller.abort(reason)
    }
    return content
  }) as typeof fs.readFile)
}

describe('managed journal read cancellation', () => {
  it.each(['records', 'inherited-records', 'scope'] as const)('does no filesystem I/O when %s reading starts cancelled', async (kind) => {
    const operations = [
      vi.spyOn(fs, 'lstat'),
      vi.spyOn(fs, 'readdir'),
      vi.spyOn(fs, 'readFile'),
      vi.spyOn(fs, 'realpath'),
      vi.spyOn(fs, 'writeFile'),
      vi.spyOn(fs, 'mkdir'),
      vi.spyOn(fs, 'mkdtemp'),
      vi.spyOn(fs, 'rename'),
      vi.spyOn(fs, 'rm'),
    ]
    controller.abort(reason)

    const reading = kind === 'scope'
      ? resolveManagedJournalScope(root, controller.signal)
      : readManagedWechatProjectRecords(kind === 'records' ? root : undefined, { signal: controller.signal })
    await expect(reading).rejects.toBe(reason)
    for (const operation of operations) {
      expect(operation).not.toHaveBeenCalled()
    }
  })

  it('stops after cancellation during marker reading and passes the signal to readFile', async () => {
    await record(root)
    await createManagedChildJournal(root, root)
    const marker = path.join(root, '.ownership-scope')
    const readFile = abortAfterFileRead(marker)

    await expect(readManagedWechatProjectRecords(root, { signal: controller.signal })).rejects.toBe(reason)
    expect(readFile).toHaveBeenCalledExactlyOnceWith(marker, { encoding: 'utf8', signal: controller.signal })
  })

  it.each(['marker', 'record'] as const)('preserves the cancellation reason when native %s readFile rejects', async (kind) => {
    const value = await record(root)
    const selected = path.join(root, kind === 'marker' ? '.ownership-scope' : `${value.id}.json`)
    const original = fs.readFile
    const readFile = vi.spyOn(fs, 'readFile').mockImplementation((async (...args: Parameters<typeof fs.readFile>) => {
      if (String(args[0]) === selected) {
        controller.abort(reason)
      }
      return await Reflect.apply(original, fs, args)
    }) as typeof fs.readFile)

    await expect(readManagedWechatProjectRecords(root, { signal: controller.signal })).rejects.toBe(reason)
    expect(readFile).toHaveBeenLastCalledWith(selected, { encoding: 'utf8', signal: controller.signal })
  })

  it('stops after cancellation during a record read without reading another record or child', async () => {
    const first = await record(root)
    await record(root)
    const nested = await createManagedChildJournal(root, root)
    await record(nested)
    const firstFile = path.join(root, `${first.id}.json`)
    const original = fs.readdir
    const readdir = vi.spyOn(fs, 'readdir').mockImplementation((async (...args: Parameters<typeof fs.readdir>) => {
      const entries = await Reflect.apply(original, fs, args) as Awaited<ReturnType<typeof fs.readdir>>
      if (String(args[0]) === root) {
        // 只固定本场景的首个记录，不依赖操作系统的目录排序。
        return [...entries].sort((left, right) => Number(String(right.name) === `${first.id}.json`) - Number(String(left.name) === `${first.id}.json`))
      }
      return entries
    }) as typeof fs.readdir)
    const readFile = abortAfterFileRead(firstFile)

    await expect(readManagedWechatProjectRecords(root, { signal: controller.signal })).rejects.toBe(reason)
    expect(readFile.mock.calls.filter(([file]) => String(file).endsWith('.json')).map(([file]) => String(file))).toEqual([firstFile])
    expect(readFile).toHaveBeenLastCalledWith(firstFile, { encoding: 'utf8', signal: controller.signal })
    expect(readdir.mock.calls.map(([selected]) => String(selected))).toEqual([root])
  })

  it('checks cancellation after lstat before reading scope metadata', async () => {
    const original = fs.lstat
    const lstat = vi.spyOn(fs, 'lstat').mockImplementation((async (...args: Parameters<typeof fs.lstat>) => {
      const stat = await Reflect.apply(original, fs, args)
      controller.abort(reason)
      return stat
    }) as typeof fs.lstat)
    const readFile = vi.spyOn(fs, 'readFile')

    await expect(readManagedWechatProjectRecords(root, { signal: controller.signal })).rejects.toBe(reason)
    expect(lstat).toHaveBeenCalledTimes(1)
    expect(readFile).not.toHaveBeenCalled()
  })

  it.each(['root', 'children'] as const)('checks cancellation after listing %s before traversing the entries', async (kind) => {
    const nested = await createManagedChildJournal(root, root)
    const selected = kind === 'root' ? root : path.join(root, 'children')
    const original = fs.readdir
    const readdir = vi.spyOn(fs, 'readdir').mockImplementation((async (...args: Parameters<typeof fs.readdir>) => {
      const entries = await Reflect.apply(original, fs, args)
      if (String(args[0]) === selected) {
        controller.abort(reason)
      }
      return entries
    }) as typeof fs.readdir)
    const readFile = vi.spyOn(fs, 'readFile')

    await expect(readManagedWechatProjectRecords(root, { signal: controller.signal })).rejects.toBe(reason)
    expect(readdir.mock.calls.some(([file]) => String(file) === nested)).toBe(false)
    expect(readFile.mock.calls.some(([file]) => String(file).startsWith(`${nested}${path.sep}`))).toBe(false)
    if (kind === 'root') {
      expect(readFile).not.toHaveBeenCalled()
    }
  })

  it('checks cancellation after resolving the root path before the next realpath call', async () => {
    const original = fs.realpath
    const realpath = vi.spyOn(fs, 'realpath').mockImplementation((async (...args: Parameters<typeof fs.realpath>) => {
      const resolved = await Reflect.apply(original, fs, args)
      controller.abort(reason)
      return resolved
    }) as typeof fs.realpath)

    await expect(readManagedWechatProjectRecords(root, { signal: controller.signal })).rejects.toBe(reason)
    expect(realpath).toHaveBeenCalledTimes(1)
  })

  it('reads root and child records with an active signal without changing the journal', async () => {
    const nested = await createManagedChildJournal(root, root)
    const expected = [await record(root), await record(nested)]
    const readFile = vi.spyOn(fs, 'readFile')
    const writeFile = vi.spyOn(fs, 'writeFile')
    const mkdir = vi.spyOn(fs, 'mkdir')
    const rm = vi.spyOn(fs, 'rm')

    const records = await readManagedWechatProjectRecords(root, { signal: controller.signal })
    expect(records).toEqual(expect.arrayContaining(expected))
    expect(records).toHaveLength(expected.length)
    for (const [, options] of readFile.mock.calls) {
      expect(options).toEqual({ encoding: 'utf8', signal: controller.signal })
    }
    expect(writeFile).not.toHaveBeenCalled()
    expect(mkdir).not.toHaveBeenCalled()
    expect(rm).not.toHaveBeenCalled()
  })
})
