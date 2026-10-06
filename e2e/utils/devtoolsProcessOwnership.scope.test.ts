import type { ResolvedWechatDevtoolsTarget } from '../../packages/weapp-ide-cli/src/devtoolsTarget'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { beginManagedWechatProject, cleanupManagedWechatProjects, readManagedWechatProjectRecords } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership'
import { withManagedJournalLock, writeManagedRecord } from '../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/journal'
import { createDevtoolsProjectJournal } from './devtoolsProcessOwnership'

const mocks = vi.hoisted(() => ({ close: vi.fn(), windowClosed: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.close }))
vi.mock('@weapp-vite/devtools-runtime', async original => ({
  ...await original<object>(),
  // 此处只验证真实磁盘 journal 的作用域，不获取用户会话的机器租约。
  withMachineE2ELease: async (run: () => Promise<unknown>) => await run(),
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/host', async original => ({
  ...await original<object>(),
  readManagedProcessIdentity: async (pid: number) => ({ pid, executable: 'test-host', started: 'test-generation' }),
  inspectManagedProjectHost: async () => ({ pid: process.pid, executable: 'test-host', started: 'test-generation' }),
  isManagedPortClosed: async () => false,
  waitForManagedPortClosed: async () => {},
  assertManagedInstallation: async () => {},
}))
vi.mock('../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/windowClose', () => ({
  captureManagedWindowClose: async () => ({
    protocol: 'wechat-devtools-window-close-trace-v1',
    profileDir: 'selected-profile',
    productVersion: 'test-version',
    capturedAt: new Date().toISOString(),
    cursors: [{ name: 'selected.log', identity: '1:2', offset: 0, anchor: 'a'.repeat(64), skipPartialLine: false }],
    calls: [],
  }),
  waitForManagedWindowClosed: mocks.windowClosed,
}))

let directory: string
let root: string
let target: ResolvedWechatDevtoolsTarget

beforeEach(async () => {
  vi.clearAllMocks()
  mocks.close.mockResolvedValue({ exitCode: 0 })
  mocks.windowClosed.mockResolvedValue(undefined)
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'devtools-journal-scope-'))
  root = path.join(directory, 'first-task')
  target = { cliPath: path.join(directory, 'cli'), appPath: path.join(directory, 'app'), profileDir: path.join(directory, 'profile'), installationId: 'selected', version: 'test-version', channel: 'stable' }
})

afterEach(async () => {
  await fs.rm(directory, { recursive: true, force: true })
})

async function begin(journalPath: string, name: string, maxOwnedWindows?: 1 | 2) {
  return (await beginManagedWechatProject({ target, projectPath: path.join(directory, name), journalPath, maxOwnedWindows }))!
}

async function owned(journalPath: string, name: string, maxOwnedWindows?: 1 | 2) {
  const intent = await begin(journalPath, name, maxOwnedWindows)
  await intent.confirm({ openedProjectWindow: true, port: 19001 })
  return intent
}

describe('DevTools task journal scope', () => {
  it('rejects a new sibling after a caller catches its previous window close failure', async () => {
    const first = await createDevtoolsProjectJournal(root)
    const intent = await owned(first, 'first-project')
    mocks.windowClosed.mockRejectedValueOnce(new Error('original MAIN log rotated'))
    await expect(intent.close()).rejects.toThrow('original MAIN log rotated')
    expect((await readManagedWechatProjectRecords(first))[0]).toMatchObject({ state: 'failed' })

    const retry = await createDevtoolsProjectJournal(root)
    await expect(begin(retry, 'next-project')).rejects.toThrow('unresolved ownership')
    expect(await readManagedWechatProjectRecords(retry)).toEqual([])
    expect(mocks.close).toHaveBeenCalledOnce()
  })

  it.each(['starting', 'unconfirmed', 'closing', 'failed'] as const)('rejects a sibling while a persisted %s record remains unresolved', async (state) => {
    const first = await createDevtoolsProjectJournal(root)
    const next = await createDevtoolsProjectJournal(root)
    await begin(first, 'first-project')
    await withManagedJournalLock(first, async () => {
      const record = (await readManagedWechatProjectRecords(first))[0]!
      await writeManagedRecord({ ...record, state })
    })

    await expect(begin(next, 'next-project')).rejects.toThrow('unresolved ownership')
    expect(await readManagedWechatProjectRecords(next)).toEqual([])
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('inherits the task boundary through nested child journals', async () => {
    const first = await createDevtoolsProjectJournal(root)
    const branch = await createDevtoolsProjectJournal(root)
    const nested = await createDevtoolsProjectJournal(branch)
    const intent = await begin(first, 'first-project')
    await intent.fail(new Error('worker exited before receipt'))

    await expect(begin(nested, 'nested-project')).rejects.toThrow('unresolved ownership')
    expect(await readManagedWechatProjectRecords(nested)).toEqual([])
  })

  it('checks and registers sibling starts atomically', async () => {
    const first = await createDevtoolsProjectJournal(root)
    const second = await createDevtoolsProjectJournal(root)
    const results = await Promise.allSettled([begin(first, 'first-project'), begin(second, 'second-project')])

    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(results.filter(result => result.status === 'rejected')).toHaveLength(1)
    expect(await readManagedWechatProjectRecords(root)).toHaveLength(1)
  })

  it('cannot register another start while a sibling close is still resolving', async () => {
    const first = await createDevtoolsProjectJournal(root)
    const second = await createDevtoolsProjectJournal(root)
    const intent = await owned(first, 'first-project')
    const entered = Promise.withResolvers<void>()
    const finish = Promise.withResolvers<void>()
    mocks.windowClosed.mockImplementationOnce(async () => {
      entered.resolve()
      await finish.promise
      throw new Error('native close unresolved')
    })
    const closing = expect(intent.close()).rejects.toThrow('native close unresolved')
    await entered.promise
    const starting = expect(begin(second, 'second-project')).rejects.toThrow('unresolved ownership')
    try {
      expect(await readManagedWechatProjectRecords(second)).toEqual([])
    }
    finally {
      finish.resolve()
      await Promise.all([closing, starting])
    }
  })

  it.each([true, false])('applies explicit concurrency to an earlier healthy opened=%s receipt', async (openedProjectWindow) => {
    const first = await createDevtoolsProjectJournal(root)
    const second = await createDevtoolsProjectJournal(root)
    const intent = await begin(first, 'first-project')
    await intent.confirm({ openedProjectWindow, port: 19001 })

    if (openedProjectWindow) {
      await expect(begin(second, 'second-project')).rejects.toThrow('window budget')
    }
    await expect(owned(second, 'second-project', openedProjectWindow ? 2 : undefined)).resolves.toBeDefined()
    expect((await readManagedWechatProjectRecords(root)).map(record => record.state).sort()).toEqual(openedProjectWindow ? ['owned', 'owned'] : ['borrowed', 'owned'])
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('does not adopt or block another independent task journal', async () => {
    const first = await createDevtoolsProjectJournal(root)
    const unrelated = await createDevtoolsProjectJournal(path.join(directory, 'other-task'))
    await begin(first, 'first-project')

    await expect(owned(unrelated, 'unrelated-project')).resolves.toBeDefined()
    expect(await readManagedWechatProjectRecords(root)).toHaveLength(1)
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('keeps cleanup restricted to its explicit child even when siblings share the gate', async () => {
    const first = await createDevtoolsProjectJournal(root)
    const second = await createDevtoolsProjectJournal(root)
    const a = await owned(first, 'first-project')
    const b = await owned(second, 'second-project', 2)

    await cleanupManagedWechatProjects({ journalPath: first, scope: 'journal' })
    expect((await readManagedWechatProjectRecords(first))[0]).toMatchObject({ id: a.id, state: 'released' })
    expect((await readManagedWechatProjectRecords(second))[0]).toMatchObject({ id: b.id, state: 'owned' })
    expect(mocks.close).toHaveBeenCalledExactlyOnceWith(target.cliPath, ['close', '--project', path.join(directory, 'first-project')], { timeout: 30_000, windowsHide: true })
  })

  it.each(['missing', 'reparented'] as const)('refuses parent cleanup when a registered child scope becomes %s', async (state) => {
    const first = await createDevtoolsProjectJournal(root)
    await owned(first, 'first-project')
    const marker = path.join(first, '.ownership-scope')
    if (state === 'missing') {
      await fs.rm(marker)
    }
    else {
      await fs.writeFile(marker, JSON.stringify({ schemaVersion: 1, rootPath: first, scopeId: randomUUID() }))
    }

    await expect(readManagedWechatProjectRecords(root)).rejects.toThrow(/scope/)
    await expect(cleanupManagedWechatProjects({ journalPath: root, scope: 'journal' })).rejects.toThrow(/scope/)
    expect(mocks.close).not.toHaveBeenCalled()
  })
})
