import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createManagedWechatProjectJournal, readManagedWechatProjectRecords, withManagedJournalLock } from '../journal'
import { resolveManagedJournalScope } from './scope'

let directory: string

beforeEach(async () => {
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-journal-scope-'))
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

async function root() {
  return await createManagedWechatProjectJournal(directory)
}

async function child(parent: string) {
  return await createManagedWechatProjectJournal(directory, parent)
}

describe('managed journal scope identity', () => {
  it('persists a single root identity through nested journals without creating project records', async () => {
    const first = await root()
    const expected = await resolveManagedJournalScope(first)
    const original = await fs.readFile(path.join(first, '.ownership-scope'), 'utf8')
    const nested = await child(await child(first))

    expect(expected.scopeId).toBeTypeOf('string')
    expect(await resolveManagedJournalScope(nested)).toEqual(expected)
    expect(await readManagedWechatProjectRecords(first)).toEqual([])
    expect(await fs.readFile(path.join(first, '.ownership-scope'), 'utf8')).toBe(original)
  })

  it('serializes sibling transactions using the registered root lock', async () => {
    const parent = await root()
    const first = await child(parent)
    const second = await child(parent)
    const values: number[] = []
    await Promise.all([first, second, first, second].map((journal, index) => withManagedJournalLock(journal, async (scopeRoot) => {
      expect(scopeRoot).toBe(parent)
      const before = values.length
      await fs.readFile(path.join(parent, '.ownership-scope'))
      expect(values).toHaveLength(before)
      values.push(index)
    })))
    expect(values).toHaveLength(4)
    await expect(fs.access(path.join(parent, '.ownership-lock'))).rejects.toThrow()
  })

  it('promotes an explicit legacy parent only once while child creation races', async () => {
    const parent = path.join(directory, 'legacy-task')
    const journals = await Promise.all(Array.from({ length: 4 }, () => child(parent)))
    const identities = await Promise.all(journals.map(resolveManagedJournalScope))
    expect(identities.every(identity => identity.scopeId === identities[0]!.scopeId)).toBe(true)
    expect(new Set(journals).size).toBe(4)
  })

  it('keeps an unregistered legacy journal local instead of searching its ancestors', async () => {
    const parent = await root()
    const legacy = path.join(parent, 'children', 'legacy-task')
    await fs.mkdir(legacy, { recursive: true })
    expect(await resolveManagedJournalScope(legacy)).toEqual({ rootPath: legacy })
  })

  it.each(['root', 'child'] as const)('refuses missing %s metadata without falling back to an independent scope', async (missing) => {
    const parent = await root()
    const nested = await child(parent)
    await fs.rm(path.join(missing === 'root' ? parent : nested, '.ownership-scope'))

    await expect(withManagedJournalLock(nested, async () => undefined)).rejects.toThrow(/metadata is missing|scope identity changed/)
  })

  it('rejects a replaced root generation and preserves both metadata records', async () => {
    const parent = await root()
    const nested = await child(parent)
    const original = await fs.readFile(path.join(nested, '.ownership-scope'), 'utf8')
    await fs.writeFile(path.join(parent, '.ownership-scope'), JSON.stringify({ schemaVersion: 1, rootPath: parent, scopeId: randomUUID() }))

    await expect(resolveManagedJournalScope(nested)).rejects.toThrow('scope identity changed')
    expect(await fs.readFile(path.join(nested, '.ownership-scope'), 'utf8')).toBe(original)
  })

  it.each(['missing', 'replaced'] as const)('rejects a %s intermediate scope before two journal locks can diverge', async (state) => {
    const parent = await root()
    const middle = await child(parent)
    const nested = await child(middle)
    const marker = path.join(middle, '.ownership-scope')
    if (state === 'missing') {
      await fs.rm(marker)
    }
    else {
      await fs.writeFile(marker, JSON.stringify({ schemaVersion: 1, rootPath: middle, scopeId: randomUUID() }))
    }
    let entered = false

    await expect(withManagedJournalLock(nested, async () => {
      entered = true
    })).rejects.toThrow('scope chain changed')
    expect(entered).toBe(false)
  })

  it('refuses copied metadata from a different task even when the scope id is valid', async () => {
    const parent = await root()
    const other = await root()
    const nested = await child(parent)
    await fs.copyFile(path.join(other, '.ownership-scope'), path.join(nested, '.ownership-scope'))

    await expect(resolveManagedJournalScope(nested)).rejects.toThrow('outside its registered task children')
    expect(await readManagedWechatProjectRecords(other)).toEqual([])
  })

  it('rejects malformed metadata instead of treating the journal as legacy', async () => {
    const parent = await root()
    await fs.writeFile(path.join(parent, '.ownership-scope'), '{')
    await expect(resolveManagedJournalScope(parent)).rejects.toThrow()
  })

  it('rejects symbolic-link metadata without modifying its source', async () => {
    const parent = await root()
    const nested = await child(parent)
    const source = path.join(parent, '.ownership-scope')
    const original = await fs.readFile(source, 'utf8')
    await fs.rm(path.join(nested, '.ownership-scope'))
    await fs.symlink(source, path.join(nested, '.ownership-scope'))

    await expect(resolveManagedJournalScope(nested)).rejects.toThrow('regular metadata file')
    expect(await fs.readFile(source, 'utf8')).toBe(original)
  })
})
