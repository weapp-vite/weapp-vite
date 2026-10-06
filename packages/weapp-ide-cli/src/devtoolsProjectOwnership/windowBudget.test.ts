import type { ResolvedWechatDevtoolsTarget } from '../devtoolsTarget'
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { ensureManagedWechatProject } from '../cli/managedProjectGate'
import { beginManagedWechatProject, MANAGED_PROJECT_JOURNAL_ENV, readManagedWechatProjectRecords } from './index'
import { createManagedWechatProjectJournal } from './journal'

const mocks = vi.hoisted(() => ({ inspect: vi.fn(), close: vi.fn() }))
vi.mock('execa', () => ({ execa: mocks.close }))
vi.mock('@weapp-vite/devtools-runtime', async importOriginal => ({
  ...await importOriginal<object>(),
  withMachineE2ELease: async (run: () => Promise<unknown>) => run(),
}))
vi.mock('./host', async importOriginal => ({
  ...await importOriginal<object>(),
  inspectManagedProjectHost: mocks.inspect,
  readManagedProcessIdentity: async () => ({ pid: 42, executable: 'selected-host', started: 'first-start' }),
  isManagedPortClosed: async () => false,
  waitForManagedPortClosed: async () => {},
  assertManagedInstallation: async () => {},
}))
vi.mock('./windowClose', () => ({
  captureManagedWindowClose: async () => ({
    protocol: 'wechat-devtools-window-close-trace-v1',
    profileDir: 'profile',
    productVersion: '1.0.0',
    capturedAt: new Date().toISOString(),
    cursors: [{ name: 'selected.log', identity: '1:2', offset: 0, anchor: 'a'.repeat(64), skipPartialLine: false }],
    calls: [],
  }),
  waitForManagedWindowClosed: async () => {},
}))

const budgetEnv = 'WEAPP_IDE_MANAGED_PROJECT_MAX_WINDOWS'
const host = { pid: 42, executable: 'selected-host', started: 'first-start' }
let directory: string
let journalPath: string
let target: ResolvedWechatDevtoolsTarget

beforeEach(async () => {
  vi.resetAllMocks()
  vi.stubEnv(budgetEnv, undefined)
  directory = await fs.mkdtemp(path.join(os.tmpdir(), 'managed-window-budget-'))
  journalPath = await createManagedWechatProjectJournal(directory)
  target = { cliPath: path.join(directory, 'cli'), appPath: path.join(directory, 'app'), profileDir: path.join(directory, 'profile'), installationId: 'selected', version: '1.0.0', channel: 'stable' }
  vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, journalPath)
  mocks.inspect.mockResolvedValue(host)
  mocks.close.mockResolvedValue({ exitCode: 0 })
})

afterEach(async () => {
  vi.unstubAllEnvs()
  await fs.rm(directory, { recursive: true, force: true })
})

function begin(name: string, options: { maxOwnedWindows?: 1 | 2, journalPath?: string, port?: number } = {}) {
  return beginManagedWechatProject({ target, projectPath: path.join(directory, name), port: 19001, ...options })
}

async function owned(name: string, options: { maxOwnedWindows?: 1 | 2, journalPath?: string, port?: number } = {}) {
  const intent = (await begin(name, options))!
  await intent.confirm({ openedProjectWindow: true, port: options.port ?? 19001 })
  return intent
}

describe('managed task window budget', () => {
  it('rejects a second owned window before persisting another launch intent', async () => {
    const first = await owned('first')
    await expect(begin('second')).rejects.toThrow('window budget')
    expect(await readManagedWechatProjectRecords()).toEqual([expect.objectContaining({ id: first.id, state: 'owned' })])
  })

  it('releases capacity only after the previous window cleanup completes', async () => {
    const first = await owned('first')
    await first.close()
    await owned('second')
    expect((await readManagedWechatProjectRecords()).filter(record => record.state === 'owned')).toHaveLength(1)
  })

  it('allows the explicit two-window exception and refuses a third', async () => {
    vi.stubEnv(budgetEnv, '2')
    await owned('first')
    await owned('second', { port: 19002 })
    await expect(begin('third', { port: 19003 })).rejects.toThrow('window budget')
    expect(await readManagedWechatProjectRecords()).toHaveLength(2)
  })

  it('counts owned windows across registered sibling journals under one root lock', async () => {
    const firstChild = await createManagedWechatProjectJournal(directory, journalPath)
    const secondChild = await createManagedWechatProjectJournal(directory, journalPath)
    await owned('first', { journalPath: firstChild })
    await expect(begin('second', { journalPath: secondChild })).rejects.toThrow('window budget')
    await owned('second', { journalPath: secondChild, maxOwnedWindows: 2, port: 19002 })
    await expect(begin('third', { maxOwnedWindows: 2, port: 19003 })).rejects.toThrow('window budget')
  })

  it.each([1, 2] as const)('rejects another start for the same confirmed session even with window budget %s', async (maxOwnedWindows) => {
    const first = await owned('first')
    mocks.inspect.mockClear()
    await expect(begin('first', { maxOwnedWindows })).rejects.toThrow('connect-only')
    expect(await readManagedWechatProjectRecords()).toEqual([expect.objectContaining({ id: first.id, state: 'owned' })])
    expect(mocks.inspect).not.toHaveBeenCalled()
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it.each([undefined, 19002])('rejects a duplicate project start with requested port %s', async (port) => {
    await owned('first')
    await expect(begin('first', { port, maxOwnedWindows: 2 })).rejects.toThrow('connect-only')
  })

  it('does not infer reuse across installations', async () => {
    await owned('first')
    await expect(beginManagedWechatProject({ target: { ...target, installationId: 'other' }, projectPath: path.join(directory, 'first'), port: 19001 })).rejects.toThrow('window budget')
  })

  it('allows the existing project gate to reuse its confirmed endpoint without another launch intent', async () => {
    const first = await owned('first')
    const existing = await ensureManagedWechatProject(target, path.join(directory, 'first'))
    expect(existing).toMatchObject({ id: first.id, state: 'owned', port: 19001, host })
    expect(await readManagedWechatProjectRecords()).toHaveLength(1)
    expect(mocks.close).not.toHaveBeenCalled()
  })

  it('does not count a borrowed window but prevents starting its project again', async () => {
    const borrowed = (await begin('manual'))!
    await borrowed.confirm({ openedProjectWindow: false, port: 19001 })
    await expect(begin('manual', { maxOwnedWindows: 2 })).rejects.toThrow('connect-only')
    await owned('owned', { port: 19002 })
    await borrowed.close()
    expect(mocks.close).not.toHaveBeenCalled()
    await expect(begin('third')).rejects.toThrow('window budget')
  })

  it('allows the same project to start again after its previous owner is released', async () => {
    const first = await owned('first')
    await first.close()
    const next = await owned('first')
    await first.close()
    expect(mocks.close).toHaveBeenCalledOnce()
    expect(await readManagedWechatProjectRecords()).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: first.id, state: 'released' }),
      expect.objectContaining({ id: next.id, state: 'owned' }),
    ]))
  })

  it('continues to block unresolved starts even with the two-window exception', async () => {
    await begin('first')
    await expect(begin('second', { maxOwnedWindows: 2 })).rejects.toThrow('unresolved ownership')
  })

  it('atomically permits only one simultaneous sibling launch intention', async () => {
    const firstChild = await createManagedWechatProjectJournal(directory, journalPath)
    const secondChild = await createManagedWechatProjectJournal(directory, journalPath)
    const results = await Promise.allSettled([begin('first', { journalPath: firstChild }), begin('second', { journalPath: secondChild })])
    expect(results.filter(result => result.status === 'fulfilled')).toHaveLength(1)
    expect(await readManagedWechatProjectRecords()).toHaveLength(1)
  })

  it.each(['0', '3', '-1', '1.5', '', 'unlimited'])('rejects invalid configured window budget %j', async (value) => {
    vi.stubEnv(budgetEnv, value)
    await expect(begin('first')).rejects.toThrow('must be 1 or 2')
    expect(await readManagedWechatProjectRecords()).toHaveLength(0)
  })

  it('does not apply task-only budgets to ordinary public CLI sessions', async () => {
    vi.stubEnv(MANAGED_PROJECT_JOURNAL_ENV, undefined)
    vi.stubEnv(budgetEnv, 'invalid')
    expect(await begin('first')).toBeUndefined()
    expect(mocks.inspect).not.toHaveBeenCalled()
  })
})
