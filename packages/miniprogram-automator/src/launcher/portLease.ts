/**
 * @file DevTools 自动化端口租约。
 */
import fs from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { getPort } from '../internal/compat'

const DEFAULT_PORT = 9420
const PORT_RANGE_SIZE = 200
const PORT_LEASE_DIR = path.join(os.tmpdir(), 'weapp-vite-automator-port-leases')

export interface AutomatorPortLease {
  path?: string
  port: number
  release: () => Promise<void>
}

export function createCandidatePorts(preferredPort = DEFAULT_PORT) {
  return Array.from({ length: PORT_RANGE_SIZE }, (_, index) => preferredPort + index)
}

function isPathExistsError(error: unknown) {
  return error && typeof error === 'object' && 'code' in error && error.code === 'EEXIST'
}

function isProcessAlive(pid: number) {
  try {
    process.kill(pid, 0)
    return true
  }
  catch (error) {
    if (error && typeof error === 'object' && 'code' in error && error.code === 'ESRCH') {
      return false
    }
    return true
  }
}

async function removePortLock(leasePath: string) {
  await fs.rm(leasePath, { force: true }).catch(() => {})
}

async function removeStalePortLock(leasePath: string) {
  try {
    const raw = await fs.readFile(leasePath, 'utf8')
    const payload = JSON.parse(raw) as { pid?: unknown }
    if (typeof payload.pid === 'number' && isProcessAlive(payload.pid)) {
      return false
    }
  }
  catch {
  }
  await removePortLock(leasePath)
  return true
}

async function writePortLock(port: number, leasePath: string) {
  const handle = await fs.open(leasePath, 'wx')
  await handle.writeFile(JSON.stringify({
    pid: process.pid,
    port,
    updatedAt: new Date().toISOString(),
  }))
  await handle.close()
}

async function createPortLock(port: number) {
  await fs.mkdir(PORT_LEASE_DIR, { recursive: true })
  const leasePath = path.join(PORT_LEASE_DIR, `${port}.lock`)
  try {
    await writePortLock(port, leasePath)
  }
  catch (error) {
    if (!isPathExistsError(error) || !(await removeStalePortLock(leasePath))) {
      throw error
    }
    await writePortLock(port, leasePath)
  }
  return leasePath
}

function createLease(port: number, leasePath?: string): AutomatorPortLease {
  let released = false
  return {
    path: leasePath,
    port,
    release: async () => {
      if (released) {
        return
      }
      released = true
      if (leasePath) {
        await removePortLock(leasePath)
      }
    },
  }
}

/**
 * @description 选择并短暂租约一个自动化端口，避免并发启动选择到同一端口。
 */
export async function acquireAutomatorPortLease(preferredPort?: number): Promise<AutomatorPortLease> {
  if (preferredPort) {
    const port = await getPort(preferredPort, '127.0.0.1')
    if (port !== preferredPort) {
      throw new Error(`Port ${preferredPort} is in use, please specify another port`)
    }
    let leasePath: string
    try {
      leasePath = await createPortLock(port)
    }
    catch (error) {
      if (isPathExistsError(error)) {
        throw new Error(`Port ${preferredPort} is in use, please specify another port`)
      }
      throw error
    }
    return createLease(port, leasePath)
  }

  for (const candidate of createCandidatePorts()) {
    const port = await getPort(candidate, '127.0.0.1')
    if (port !== candidate) {
      continue
    }
    try {
      const leasePath = await createPortLock(port)
      return createLease(port, leasePath)
    }
    catch (error) {
      if (isPathExistsError(error)) {
        continue
      }
      throw error
    }
  }

  const fallbackPort = await getPort(0, '127.0.0.1')
  return createLease(fallbackPort)
}
