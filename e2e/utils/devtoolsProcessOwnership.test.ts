import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { assertNoUnreleasedDevtoolsProjects, cleanupOwnedDevtoolsProcesses, createDevtoolsProjectJournal, ensureDevtoolsProjectJournal, ownDevtoolsCleanup } from './devtoolsProcessOwnership'

const { cleanupProjects, readRecords } = vi.hoisted(() => ({ cleanupProjects: vi.fn(async () => {}), readRecords: vi.fn(async () => []) }))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership', () => ({
  cleanupManagedWechatProjects: cleanupProjects,
  readManagedWechatProjectRecords: readRecords,
  MANAGED_PROJECT_JOURNAL_ENV: 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL',
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal/windowsSelfIdentity', () => ({
  // 此处验证真实磁盘 journal 的继承边界；Windows 身份查询由专项契约测试覆盖。
  readWindowsJournalWriterIdentity: async () => ({ pid: process.pid, executable: 'test-host', started: 'test-generation' }),
}))

const journals: string[] = []
const roots: string[] = []

describe('DevTools process ownership', () => {
  afterEach(async () => {
    await Promise.all(journals.splice(0).map(journal => fs.rm(journal, { recursive: true, force: true })))
    await Promise.all(roots.splice(0).map(root => fs.rm(root, { recursive: true, force: true })))
    vi.clearAllMocks()
    vi.unstubAllEnvs()
  })

  it('blocks a new root journal when an older task still owns an IDE project', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devtools-journal-inventory-'))
    roots.push(root)
    const stale = path.join(root, 'task-scope-stale')
    await fs.mkdir(stale)
    readRecords.mockResolvedValue([{
      projectPath: '/repo/stale-project',
      state: 'unconfirmed',
      port: 58802,
      ownerPid: 1234,
    }] as never)

    await expect(assertNoUnreleasedDevtoolsProjects(root)).rejects.toThrow(/unresolved project ownership.*unconfirmed.*58802/)
    await expect(createDevtoolsProjectJournal('', root)).rejects.toThrow(/unresolved project ownership/)
  })

  it('allows a new root journal when all previous task records are released', async () => {
    const root = await fs.mkdtemp(path.join(os.tmpdir(), 'devtools-journal-inventory-'))
    roots.push(root)
    const released = path.join(root, 'task-scope-released')
    await fs.mkdir(released)
    readRecords.mockResolvedValue([])

    await expect(assertNoUnreleasedDevtoolsProjects(root)).resolves.toBeUndefined()
    const journal = await createDevtoolsProjectJournal('', root)
    journals.push(journal)
    expect(path.dirname(journal)).toBe(root)
  })

  it('disposes only registered resources, exactly once across close and recovery', async () => {
    const owned = vi.fn(async () => {})
    const foreign = vi.fn(async () => {})
    const dispose = ownDevtoolsCleanup(owned)
    await Promise.all([dispose(), cleanupOwnedDevtoolsProcesses()])
    await cleanupOwnedDevtoolsProcesses()
    expect(owned).toHaveBeenCalledTimes(1)
    expect(foreign).not.toHaveBeenCalled()
    expect(cleanupProjects).toHaveBeenCalledWith({ scope: 'process' })
  })

  it('cleans remaining resources after one fails and keeps failed ownership for retry', async () => {
    const failed = vi.fn().mockRejectedValueOnce(new Error('busy')).mockResolvedValue(undefined)
    const other = vi.fn(async () => {})
    ownDevtoolsCleanup(failed)
    ownDevtoolsCleanup(other)
    await expect(cleanupOwnedDevtoolsProcesses()).rejects.toThrow('Failed to clean owned')
    expect(other).toHaveBeenCalledTimes(1)
    await cleanupOwnedDevtoolsProcesses()
    expect(failed).toHaveBeenCalledTimes(2)
    expect(other).toHaveBeenCalledTimes(1)
  })

  it('cleans registered project windows even when disconnect fails', async () => {
    const disconnect = vi.fn().mockRejectedValueOnce(new Error('disconnected')).mockResolvedValue(undefined)
    ownDevtoolsCleanup(disconnect)

    await expect(cleanupOwnedDevtoolsProcesses({ journalPath: 'task-journal', scope: 'journal' })).rejects.toThrow('Failed to clean owned')
    expect(cleanupProjects).toHaveBeenCalledWith({ journalPath: 'task-journal', scope: 'journal' })
    await cleanupOwnedDevtoolsProcesses()
  })

  it('reports project cleanup failures and leaves their retry to the owner journal', async () => {
    cleanupProjects.mockRejectedValueOnce(new Error('window remains open'))
    await expect(cleanupOwnedDevtoolsProcesses()).rejects.toThrow('Failed to clean owned')
    await cleanupOwnedDevtoolsProcesses()
    expect(cleanupProjects).toHaveBeenCalledTimes(2)
  })

  it('reuses an inherited journal and nests new task journals beneath its owned children', async () => {
    const parent = await createDevtoolsProjectJournal('')
    journals.push(parent)
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', parent)

    expect(await ensureDevtoolsProjectJournal()).toBe(parent)
    const first = await createDevtoolsProjectJournal()
    const second = await createDevtoolsProjectJournal()
    expect(path.dirname(first)).toBe(path.join(parent, 'children'))
    expect(path.dirname(second)).toBe(path.join(parent, 'children'))
    expect(first).not.toBe(second)
    expect(process.env.WEAPP_IDE_MANAGED_PROJECT_JOURNAL).toBe(parent)
  })

  it('gives a directly invoked worker an independent journal', async () => {
    vi.stubEnv('WEAPP_IDE_MANAGED_PROJECT_JOURNAL', '')
    const journal = await ensureDevtoolsProjectJournal()
    journals.push(journal)

    expect((await fs.stat(journal)).isDirectory()).toBe(true)
    expect(process.env.WEAPP_IDE_MANAGED_PROJECT_JOURNAL).toBe(journal)
    expect(await ensureDevtoolsProjectJournal()).toBe(journal)
  })
})
