import type { ManagedWechatProjectRecord } from '../types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { readManagedWechatProjectRecords, writeManagedRecord } from '../journal'
import * as scopes from './scope'

type RegisteredScope = Awaited<ReturnType<typeof scopes.initializeManagedJournalScope>>
let directory: string
let root: string
let identity: RegisteredScope

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-record-scan-'))
  root = await fs.mkdtemp(path.join(directory, 'task-scope-'))
  identity = await scopes.initializeManagedJournalScope(root)
})
afterEach(async () => {
  vi.restoreAllMocks()
  await fs.rm(directory, { recursive: true, force: true })
})

async function marker(journal: string, value: RegisteredScope) {
  await fs.writeFile(path.join(journal, '.ownership-scope'), JSON.stringify(value))
}

async function child(parent: string, value = identity) {
  const children = path.join(parent, 'children')
  await fs.mkdir(children, { recursive: true })
  const journal = await fs.mkdtemp(path.join(children, 'task-scope-'))
  await marker(journal, value)
  return journal
}

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

function afterDirectoryRead(selected: string, mutate: () => Promise<void>) {
  const original = fs.readdir
  let changed = false
  return vi.spyOn(fs, 'readdir').mockImplementation((async (...args: Parameters<typeof fs.readdir>) => {
    const entries = await Reflect.apply(original, fs, args) as Awaited<ReturnType<typeof fs.readdir>>
    if (!changed && String(args[0]) === selected) {
      changed = true
      await mutate()
    }
    return entries
  }) as typeof fs.readdir)
}

describe('managed journal recursive record scan', () => {
  it('reads a real deep tree and resolves each directory once per independent scan', async () => {
    const journals = [root]
    const expected = [await record(root)]
    for (let depth = 0; depth < 5; depth++) {
      journals.push(await child(journals.at(-1)!))
      expected.push(await record(journals.at(-1)!))
    }
    const sibling = await child(root)
    journals.push(sibling)
    expected.push(await record(sibling))
    const resolve = vi.spyOn(scopes, 'resolveManagedJournalScope')

    const first = await readManagedWechatProjectRecords(root)
    expect(first).toHaveLength(expected.length)
    expect(first).toEqual(expect.arrayContaining(expected))
    expect(resolve.mock.calls.map(([journal]) => journal).sort()).toEqual([...journals].sort())

    resolve.mockClear()
    expect(await readManagedWechatProjectRecords(root)).toEqual(first)
    expect(resolve.mock.calls.map(([journal]) => journal).sort()).toEqual([...journals].sort())
  })

  it('allows a missing public root without suppressing later scope or record errors', async () => {
    await expect(readManagedWechatProjectRecords(path.join(directory, 'missing-root'))).resolves.toEqual([])
    const value = await record(root)
    afterDirectoryRead(root, () => fs.rm(path.join(root, `${value.id}.json`)))

    await expect(readManagedWechatProjectRecords(root)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('rejects a registered child that disappears after it was enumerated', async () => {
    const nested = await child(root)
    afterDirectoryRead(path.join(root, 'children'), () => fs.rm(nested, { recursive: true }))

    await expect(readManagedWechatProjectRecords(root)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it('also rejects a disappearing legacy child whose parent scope has no id', async () => {
    const legacy = path.join(directory, 'legacy-root')
    const nested = path.join(legacy, 'children', 'legacy-child')
    await fs.mkdir(nested, { recursive: true })
    afterDirectoryRead(path.join(legacy, 'children'), () => fs.rm(nested, { recursive: true }))

    await expect(readManagedWechatProjectRecords(legacy)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['registered', 'legacy'] as const)('rejects a %s child removed after its directory precheck', async (kind) => {
    const parent = kind === 'registered' ? root : path.join(directory, 'legacy-root')
    const nested = kind === 'registered' ? await child(parent) : path.join(parent, 'children', 'legacy-child')
    if (kind === 'legacy') {
      await fs.mkdir(nested, { recursive: true })
    }
    const original = fs.readdir
    let removed = false
    vi.spyOn(fs, 'readdir').mockImplementation((async (...args: Parameters<typeof fs.readdir>) => {
      if (!removed && String(args[0]) === nested) {
        removed = true
        await fs.rm(nested, { recursive: true })
      }
      return await Reflect.apply(original, fs, args)
    }) as typeof fs.readdir)

    await expect(readManagedWechatProjectRecords(parent)).rejects.toMatchObject({ code: 'ENOENT' })
    expect(removed).toBe(true)
  })

  it('rejects a public root removed after its initial enumeration', async () => {
    afterDirectoryRead(root, () => fs.rm(root, { recursive: true }))

    await expect(readManagedWechatProjectRecords(root)).rejects.toMatchObject({ code: 'ENOENT' })
  })

  it.each(['missing', 'corrupt', 'replaced'] as const)('refuses %s child metadata after enumeration', async (kind) => {
    const nested = await child(root)
    const file = path.join(nested, '.ownership-scope')
    afterDirectoryRead(path.join(root, 'children'), async () => {
      if (kind === 'missing') {
        await fs.rm(file)
      }
      else if (kind === 'corrupt') {
        await fs.writeFile(file, '{')
      }
      else { await marker(nested, { ...identity, scopeId: randomUUID() }) }
    })

    await expect(readManagedWechatProjectRecords(root)).rejects.toThrow()
  })

  it('compares the child against its observed parent after a whole scope generation changes during readdir', async () => {
    const nested = await child(root)
    await record(nested)
    afterDirectoryRead(nested, async () => {
      // 旧实现先比较child，递归readdir后第二次解析却不再比较父快照，会接受整棵树的新generation。
      const replacement = { ...identity, scopeId: randomUUID() }
      await marker(root, replacement)
      await marker(nested, replacement)
    })

    await expect(readManagedWechatProjectRecords(root)).rejects.toThrow('scope changed inside its registered children')
  })

  it('preserves unregistered legacy roots and children with distinct local boundaries', async () => {
    const legacy = path.join(directory, 'legacy-root')
    const nested = path.join(legacy, 'children', 'legacy-child')
    await fs.mkdir(nested, { recursive: true })
    const expected = [await record(legacy), await record(nested)]

    expect(await readManagedWechatProjectRecords(legacy)).toEqual(expect.arrayContaining(expected))
    expect(await scopes.resolveManagedJournalScope(legacy)).toEqual({ rootPath: legacy })
    expect(await scopes.resolveManagedJournalScope(nested)).toEqual({ rootPath: nested })
  })

  it('refuses a registered task tree inserted under an unregistered legacy parent', async () => {
    const legacy = path.join(directory, 'legacy-root')
    await fs.mkdir(path.join(legacy, 'children'), { recursive: true })
    const nested = await fs.mkdtemp(path.join(legacy, 'children', 'task-scope-'))
    await scopes.initializeManagedJournalScope(nested)

    await expect(readManagedWechatProjectRecords(legacy)).rejects.toThrow('scope changed inside its registered children')
  })

  it('rejects a child replaced by a symlink to another journal without reading its records', async () => {
    const nested = await child(root)
    const other = await fs.mkdtemp(path.join(directory, 'task-scope-'))
    await scopes.initializeManagedJournalScope(other)
    const foreignRecord = await record(other)
    const readFile = vi.spyOn(fs, 'readFile')
    const readDirectory = afterDirectoryRead(path.join(root, 'children'), async () => {
      await fs.rm(nested, { recursive: true })
      await fs.symlink(other, nested, process.platform === 'win32' ? 'junction' : 'dir')
    })

    await expect(readManagedWechatProjectRecords(root)).rejects.toThrow('must use regular directories')
    expect(readDirectory.mock.calls.some(([selected]) => String(selected) === nested)).toBe(false)
    expect(readFile.mock.calls.some(([selected]) => path.basename(String(selected)) === `${foreignRecord.id}.json`)).toBe(false)
    expect(await readManagedWechatProjectRecords(other)).toHaveLength(1)
  })

  it('rejects non-directory children instead of treating them as journals', async () => {
    await fs.mkdir(path.join(root, 'children'))
    await fs.writeFile(path.join(root, 'children', 'unknown'), 'preserve')

    await expect(readManagedWechatProjectRecords(root)).rejects.toThrow('child journal is not a regular directory')
  })

  it('rereads scope metadata on a later public call', async () => {
    const nested = await child(root)
    await expect(readManagedWechatProjectRecords(root)).resolves.toEqual([])
    await fs.writeFile(path.join(nested, '.ownership-scope'), '{')

    await expect(readManagedWechatProjectRecords(root)).rejects.toThrow()
  })
})
