import { randomUUID } from 'node:crypto'
import fs from 'node:fs/promises'
import os from 'node:os'
import process from 'node:process'

export interface PreparationOwner {
  pid: number
  startedAt: string
  root: string
  host: string
  token: string
}

export function createOwner(root: string): PreparationOwner {
  return { pid: process.pid, startedAt: new Date().toISOString(), root, host: os.hostname(), token: randomUUID() }
}

export function isOwner(value: unknown, root: string): value is PreparationOwner {
  if (!value || typeof value !== 'object') {
    return false
  }
  const owner = value as Partial<PreparationOwner>
  return Number.isSafeInteger(owner.pid) && owner.pid! > 0
    && typeof owner.startedAt === 'string' && Number.isFinite(Date.parse(owner.startedAt))
    && owner.root === root && owner.host === os.hostname()
    && typeof owner.token === 'string' && /^[a-f\d-]{36}$/.test(owner.token)
}

/** 只有本机内核明确报告 ESRCH 才认定宿主已退出，EPERM 等未知状态均保留。 */
export function ownerExited(owner: PreparationOwner): boolean {
  try {
    process.kill(owner.pid, 0)
    return false
  }
  catch (error) {
    return (error as NodeJS.ErrnoException).code === 'ESRCH'
  }
}

export async function readOwner(file: string, root: string): Promise<PreparationOwner | undefined> {
  try {
    const value: unknown = JSON.parse(await fs.readFile(file, 'utf8'))
    return isOwner(value, root) ? value : undefined
  }
  catch (error) {
    if (error instanceof SyntaxError || (error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

/** 释放前回读身份，避免清理已经被其他执行者替换的资源。 */
export async function removeOwnedFile(file: string, owner: PreparationOwner) {
  if ((await readOwner(file, owner.root))?.token === owner.token) {
    await fs.unlink(file)
  }
}
