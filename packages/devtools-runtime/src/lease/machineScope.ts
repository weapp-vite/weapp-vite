import type { LeaseOwner } from './directory'
import { randomUUID } from 'node:crypto'
import { mkdir, readdir, readFile, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { isProcessAlive, mutateLease, readLeaseOwner } from './directory'

export const INHERITED_LEASE_ENV = 'WEAPP_VITE_E2E_MACHINE_LEASE'
const UUID = /^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i

export interface MachineCredential extends LeaseOwner {
  scopes: string[]
}

export interface MachineE2EChildScope {
  environment: Record<string, string>
  /** 先封存借用入口，再确认该子树已无活跃借用者；失败时仍保持封存。 */
  seal: () => Promise<void>
  /** 当前命令已停止且日志清理成功后完成本 scope，不覆盖后代的未完成状态。 */
  complete: () => Promise<void>
}

interface ScopeRecord {
  owner: LeaseOwner
  ancestors: string[]
  sealed: boolean
  completed: boolean
}

function invalid() {
  return new Error('Runtime busy: inherited E2E lease is invalid or its command scope is sealed; refusing unverified child ownership.')
}

function scopesOf(value: unknown): string[] {
  if (!Array.isArray(value) || value.some(item => typeof item !== 'string' || !UUID.test(item)) || new Set(value).size !== value.length) {
    throw invalid()
  }
  return value as string[]
}

function ownerOf(value: unknown): LeaseOwner {
  if (!value || typeof value !== 'object' || !('pid' in value) || !('token' in value)
    || !Number.isInteger(value.pid) || Number(value.pid) <= 0 || typeof value.token !== 'string' || !value.token) {
    throw invalid()
  }
  return { pid: Number(value.pid), token: value.token }
}

export function parseMachineCredential(value: string): MachineCredential {
  const parsed: unknown = JSON.parse(value)
  const owner = ownerOf(parsed)
  const scopes = parsed && typeof parsed === 'object' && 'scopes' in parsed ? scopesOf(parsed.scopes) : []
  return { ...owner, scopes }
}

function sameOwner(left: LeaseOwner, right: LeaseOwner) {
  return left.pid === right.pid && left.token === right.token
}

function sameScopes(left: string[], right: string[]) {
  return left.length === right.length && left.every((token, index) => token === right[index])
}

function scopeFile(directory: string, token: string) {
  if (!UUID.test(token)) {
    throw invalid()
  }
  return path.join(directory, 'scopes', `${token}.json`)
}

async function readScope(directory: string, token: string): Promise<ScopeRecord> {
  const value: unknown = JSON.parse(await readFile(scopeFile(directory, token), 'utf8'))
  if (!value || typeof value !== 'object' || !('owner' in value) || !('ancestors' in value)
    || !('sealed' in value) || typeof value.sealed !== 'boolean'
    || !('completed' in value) || typeof value.completed !== 'boolean') {
    throw invalid()
  }
  return { owner: ownerOf(value.owner), ancestors: scopesOf(value.ancestors), sealed: value.sealed, completed: value.completed }
}

/** 调用方持有同一机器租约变更锁；派生 token 丢失祖先链时不能降级成根凭证。 */
export async function assertMachineCredential(directory: string, credential: MachineCredential, allowSealed = false) {
  const owner = await readLeaseOwner(path.join(directory, 'owner.json'))
  if (!owner || owner.pid !== credential.pid || !isProcessAlive(owner.pid)
    || credential.token !== (credential.scopes.at(-1) ?? owner.token)) {
    throw invalid()
  }
  for (const [index, token] of credential.scopes.entries()) {
    const record = await readScope(directory, token).catch(() => {
      throw invalid()
    })
    if (!sameOwner(record.owner, owner) || !sameScopes(record.ancestors, credential.scopes.slice(0, index))
      || (!allowSealed && record.sealed)) {
      throw invalid()
    }
  }
  return owner
}

async function assertScopeStopped(directory: string, token: string) {
  const borrowers = path.join(directory, 'borrowers')
  const files = await readdir(borrowers).catch((error: NodeJS.ErrnoException) => {
    if (error.code === 'ENOENT') {
      return []
    }
    throw error
  })
  for (const file of files) {
    const value: unknown = JSON.parse(await readFile(path.join(borrowers, file), 'utf8'))
    const owner = ownerOf(value)
    if (!value || typeof value !== 'object' || !('scopes' in value)) {
      throw new Error('Runtime busy: an E2E borrower has no verifiable command scope; preserve its journal.')
    }
    const scopes = scopesOf(value.scopes)
    if (scopes.includes(token) && isProcessAlive(owner.pid)) {
      throw new Error('Runtime busy: an E2E command child is still running; preserve its journal before cleanup.')
    }
  }
}

async function assertDescendantScopesCompleted(directory: string, token: string) {
  for (const file of await readdir(path.join(directory, 'scopes'))) {
    const candidate = file.endsWith('.json') ? file.slice(0, -5) : ''
    const record = await readScope(directory, candidate)
    if (record.ancestors.includes(token) && !record.completed) {
      throw new Error('Runtime busy: an E2E descendant scope has unfinished cleanup; preserve its journal before parent cleanup.')
    }
  }
}

/** 使用现有租约目录与变更锁封存命令子树，阻止存活或迟到子任务与父清理竞争。 */
export async function createMachineChildScope(directory: string, credential: MachineCredential, isHeld: () => boolean): Promise<MachineE2EChildScope> {
  const token = randomUUID()
  const scoped = { pid: credential.pid, token, scopes: [...credential.scopes, token] }
  await mutateLease(directory, async () => {
    if (!isHeld()) {
      throw invalid()
    }
    const owner = await assertMachineCredential(directory, credential)
    await mkdir(path.join(directory, 'scopes'), { recursive: true, mode: 0o700 })
    await writeFile(scopeFile(directory, token), JSON.stringify({ owner, ancestors: credential.scopes, sealed: false, completed: false }), { mode: 0o600, flag: 'wx' })
  })
  return {
    environment: { [INHERITED_LEASE_ENV]: JSON.stringify(scoped) },
    seal: () => mutateLease(directory, async () => {
      // 已取得的 scope 能力保留到根租约结束，允许父进程在借用作用域退出后接管。
      await assertMachineCredential(directory, scoped, true)
      const record = await readScope(directory, token)
      if (!record.sealed) {
        await writeFile(scopeFile(directory, token), JSON.stringify({ ...record, sealed: true }), { mode: 0o600 })
      }
      await assertScopeStopped(directory, token)
      await assertDescendantScopesCompleted(directory, token)
    }),
    complete: () => mutateLease(directory, async () => {
      await assertMachineCredential(directory, scoped, true)
      if (!(await readScope(directory, token)).sealed) {
        throw new Error('Runtime busy: E2E command scope must be sealed before completing its cleanup.')
      }
      await assertScopeStopped(directory, token)
      await assertDescendantScopesCompleted(directory, token)
      const record = await readScope(directory, token)
      await writeFile(scopeFile(directory, token), JSON.stringify({ ...record, completed: true }), { mode: 0o600 })
    }),
  }
}
