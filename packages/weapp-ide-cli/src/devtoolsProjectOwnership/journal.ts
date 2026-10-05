import type { ManagedWechatProjectRecord } from './types'
import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import path from 'node:path'
import process from 'node:process'
import { setTimeout } from 'node:timers/promises'
import { mutateLease } from '@weapp-vite/devtools-runtime'
import { z } from 'zod'
import { readManagedProcessIdentity, sameManagedProcess } from './host'
import { createManagedChildJournal, initializeManagedJournalScope, managedJournalPrefix, resolveManagedJournalScope } from './journal/scope'
import { managedWindowCloseSchema } from './windowClose/schema'

export const MANAGED_PROJECT_JOURNAL_ENV = 'WEAPP_IDE_MANAGED_PROJECT_JOURNAL'
export const managedProcessToken = randomUUID()
const idSchema = z.string().uuid()
const hostSchema = z.object({ pid: z.number().int().positive(), executable: z.string().min(1), started: z.string().min(1) })
const recordSchema = z.object({
  schemaVersion: z.literal(1),
  id: idSchema,
  generation: z.string().min(1),
  journalPath: z.string().min(1),
  ownerToken: idSchema,
  ownerPid: z.number().int().positive(),
  target: z.object({
    cliPath: z.string().min(1),
    installationId: z.string().min(1),
    appPath: z.string().min(1),
    profileDir: z.string().min(1),
    version: z.string().optional(),
    channel: z.enum(['stable', 'rc', 'nightly', 'unknown']).optional(),
  }),
  projectPath: z.string().min(1),
  state: z.enum(['starting', 'unconfirmed', 'owned', 'borrowed', 'closing', 'failed', 'released']),
  openedProjectWindow: z.boolean().optional(),
  port: z.number().int().min(1).max(65535).optional(),
  host: hostSchema.optional(),
  createdAt: z.string().min(1),
  updatedAt: z.string().min(1),
  closeAcknowledgedAt: z.string().min(1).optional(),
  windowClose: managedWindowCloseSchema.optional(),
  releasedReason: z.enum(['borrowed', 'project-closed']).optional(),
  error: z.string().optional(),
})

export function resolveManagedJournal(journalPath?: string) {
  const selected = journalPath ?? process.env[MANAGED_PROJECT_JOURNAL_ENV]
  return selected?.trim() ? path.resolve(selected) : undefined
}

export function managedRecordPath(journalPath: string, id: string) {
  return path.join(journalPath, `${idSchema.parse(id)}.json`)
}

export async function readManagedRecord(journalPath: string, id: string): Promise<ManagedWechatProjectRecord> {
  const file = managedRecordPath(journalPath, id)
  if (!(await fs.lstat(file)).isFile()) {
    throw new Error('Managed DevTools journal record is not a regular file.')
  }
  const record = recordSchema.parse(JSON.parse(await fs.readFile(file, 'utf8')) as unknown)
  if (record.id !== id || record.journalPath !== journalPath || !path.isAbsolute(record.projectPath)) {
    throw new Error('Managed DevTools journal identity does not match its task directory.')
  }
  return record
}

export async function writeManagedRecord(record: ManagedWechatProjectRecord) {
  record.updatedAt = new Date().toISOString()
  recordSchema.parse(record)
  const file = managedRecordPath(record.journalPath, record.id)
  const temporary = `${file}.${randomUUID()}.tmp`
  try {
    await fs.writeFile(temporary, `${JSON.stringify(record, null, 2)}\n`, { mode: 0o600, flag: 'wx' })
    await fs.rename(temporary, file)
  }
  finally {
    await fs.rm(temporary, { force: true })
  }
}

/** 仅递归当前任务明确传递的 children；不扫描用户缓存，不跟随符号链接。 */
export async function readManagedWechatProjectRecords(journalPath?: string): Promise<ManagedWechatProjectRecord[]> {
  const directory = resolveManagedJournal(journalPath)
  if (!directory) {
    return []
  }
  const entries = await fs.readdir(directory, { withFileTypes: true }).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
  if (!entries) {
    return []
  }
  const scope = await resolveManagedJournalScope(directory)
  const records: ManagedWechatProjectRecord[] = []
  for (const entry of entries) {
    if (entry.name.endsWith('.json')) {
      records.push(await readManagedRecord(directory, entry.name.slice(0, -5)))
    }
    else if (entry.name === 'children') {
      if (!entry.isDirectory()) {
        throw new Error('Managed DevTools child journals must be regular directories.')
      }
      const children = await fs.readdir(path.join(directory, 'children'), { withFileTypes: true })
      for (const child of children) {
        if (!child.isDirectory()) {
          throw new Error('Managed DevTools child journal is not a regular directory.')
        }
        const childPath = path.join(directory, 'children', child.name)
        const childScope = await resolveManagedJournalScope(childPath)
        if ((scope.scopeId !== undefined || childScope.scopeId !== undefined)
          && (scope.scopeId !== childScope.scopeId || scope.rootPath !== childScope.rootPath)) {
          throw new Error('Managed DevTools journal scope changed inside its registered children; refusing another task tree.')
        }
        records.push(...await readManagedWechatProjectRecords(childPath))
      }
    }
  }
  return records
}

const lockOwnerSchema = z.object({ token: idSchema, identity: hostSchema })
let currentIdentity: ReturnType<typeof readManagedProcessIdentity> | undefined

async function readLockOwner(lock: string) {
  return fs.readFile(path.join(lock, 'owner'), 'utf8').then(value => lockOwnerSchema.parse(JSON.parse(value) as unknown)).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return undefined
    }
    throw error
  })
}

async function releaseDeadLock(lock: string) {
  const owner = await readLockOwner(lock)
  if (!owner) {
    return false
  }
  const live = await readManagedProcessIdentity(owner.identity.pid)
  if (live && sameManagedProcess(live, owner.identity)) {
    return false
  }
  const current = await readLockOwner(lock)
  if (!current || current.token !== owner.token || !sameManagedProcess(current.identity, owner.identity)) {
    return false
  }
  await fs.rm(lock, { recursive: true })
  return true
}

/** 工作进程退出后父进程可回收其锁；未知身份或不完整锁保持阻塞。 */
async function withManagedJournalDirectoryLock<T>(directory: string, run: () => Promise<T>): Promise<T> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  const lock = path.join(directory, '.ownership-lock')
  const token = randomUUID()
  const identity = await (currentIdentity ??= readManagedProcessIdentity(process.pid))
  if (!identity) {
    throw new Error('Cannot identify the managed DevTools journal writer.')
  }
  const deadline = Date.now() + 45_000
  while (true) {
    const acquired = await mutateLease(lock, async () => {
      try {
        await fs.mkdir(lock, { mode: 0o700 })
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }
        if (!await releaseDeadLock(lock)) {
          return false
        }
        await fs.mkdir(lock, { mode: 0o700 })
      }
      await fs.writeFile(path.join(lock, 'owner'), JSON.stringify({ token, identity }), { mode: 0o600, flag: 'wx' })
      return true
    }, { timeoutMs: Math.max(0, deadline - Date.now()) })
    if (acquired) {
      break
    }
    if (Date.now() >= deadline) {
      throw new Error('Managed DevTools journal is still owned by another operation; refusing concurrent cleanup.')
    }
    await setTimeout(25)
  }
  const releaseLock = () => mutateLease(lock, async () => {
    const owner = await readLockOwner(lock)
    if (!owner || owner.token !== token || !sameManagedProcess(owner.identity, identity)) {
      throw new Error('Managed DevTools journal lock ownership changed; refusing cleanup.')
    }
    await fs.rm(lock, { recursive: true })
  }, { timeoutMs: 45_000 })
  try {
    return await run()
  }
  finally {
    await releaseLock()
  }
}

/** 兄弟 journal 的检查和登记共用根锁，关闭、确认和失败更新也不能绕过该边界。 */
export async function withManagedJournalLock<T>(directory: string, run: (scopeRoot: string) => Promise<T>): Promise<T> {
  await fs.mkdir(directory, { recursive: true, mode: 0o700 })
  const scope = await resolveManagedJournalScope(directory)
  return await withManagedJournalDirectoryLock(scope.rootPath, async () => {
    const current = await resolveManagedJournalScope(directory)
    if (current.rootPath !== scope.rootPath || (scope.scopeId !== undefined && current.scopeId !== scope.scopeId)) {
      throw new Error('Managed DevTools journal scope changed while waiting for its lock.')
    }
    return await run(scope.rootPath)
  })
}

/** 显式创建任务根或继承父任务作用域；清理仍使用返回的独立子目录。 */
export async function createManagedWechatProjectJournal(rootDirectory: string, parentJournalPath?: string) {
  if (parentJournalPath?.trim()) {
    const parent = path.resolve(parentJournalPath)
    return await withManagedJournalLock(parent, scopeRoot => createManagedChildJournal(parent, scopeRoot))
  }
  await fs.mkdir(rootDirectory, { recursive: true, mode: 0o700 })
  const directory = await fs.mkdtemp(path.join(rootDirectory, managedJournalPrefix))
  await initializeManagedJournalScope(directory)
  return directory
}
