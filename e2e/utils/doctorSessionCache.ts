import type { BigIntStats } from 'node:fs'
import { Buffer } from 'node:buffer'
import fs from 'node:fs/promises'
import path from 'node:path'
import { createRetryableCleanup } from './automatorBridgeCleanup'

interface SessionIdentity {
  installationId: string
  projectPath: string
  port: number
  wsEndpoint: string
}

interface FileSnapshot {
  stat: BigIntStats
  bytes: Buffer
}

function sameIdentity(left: BigIntStats, right: BigIntStats) {
  return left.dev === right.dev && left.ino === right.ino
}

function sameVersion(left: BigIntStats, right: BigIntStats) {
  return sameIdentity(left, right) && left.size === right.size
    && left.ctimeNs === right.ctimeNs && left.mtimeNs === right.mtimeNs
}

async function readSnapshot(filePath: string): Promise<FileSnapshot | undefined> {
  try {
    const before = await fs.lstat(filePath, { bigint: true })
    if (!before.isFile()) {
      return undefined
    }
    const handle = await fs.open(filePath, 'r')
    try {
      const opened = await handle.stat({ bigint: true })
      const bytes = await handle.readFile()
      const after = await handle.stat({ bigint: true })
      const linked = await fs.lstat(filePath, { bigint: true })
      if (linked.isFile() && sameVersion(before, opened) && sameVersion(opened, after) && sameVersion(after, linked)) {
        return { stat: linked, bytes }
      }
    }
    finally {
      await handle.close()
    }
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      throw error
    }
  }
}

function matchesSession(snapshot: FileSnapshot, identity: SessionIdentity) {
  try {
    const value: unknown = JSON.parse(snapshot.bytes.toString('utf8'))
    if (!value || typeof value !== 'object') {
      return false
    }
    const session = value as Record<string, unknown>
    return session.installationId === identity.installationId
      && session.projectPath === path.resolve(identity.projectPath)
      && session.port === identity.port && session.wsEndpoint === identity.wsEndpoint
      && session.sessionId === undefined && typeof session.updatedAt === 'string'
  }
  catch {
    return false
  }
}

/** 仅持有本轮独占新建的缓存；调用方确认原窗口关闭后才执行 cleanup。 */
export function createDoctorSessionCacheOwner(filePath: string, identity: SessionIdentity) {
  let owned: FileSnapshot | undefined
  let persisting: Promise<void> | undefined
  let closing = false
  const persist = (writeSession: () => Promise<void>) => {
    if (closing) {
      return Promise.reject(new Error('Doctor session cache cleanup has already started.'))
    }
    persisting ??= (async () => {
      await fs.mkdir(path.dirname(filePath), { recursive: true })
      try {
        const reserved = await fs.open(filePath, 'wx')
        try {
          owned = { stat: await reserved.stat({ bigint: true }), bytes: Buffer.alloc(0) }
        }
        finally {
          await reserved.close()
        }
      }
      catch (error) {
        if ((error as NodeJS.ErrnoException).code !== 'EEXIST') {
          throw error
        }
        const existing = await readSnapshot(filePath)
        if (!existing || !matchesSession(existing, identity)) {
          throw new Error('Doctor session cache already exists with an unowned identity; it was preserved.')
        }
        return
      }
      const captureWritten = async () => {
        const written = await readSnapshot(filePath)
        if (written && sameIdentity(owned!.stat, written.stat) && (!written.bytes.length || matchesSession(written, identity))) {
          owned = written
        }
      }
      try {
        await writeSession()
      }
      catch (error) {
        try {
          await captureWritten()
        }
        catch (snapshotError) {
          throw new AggregateError([error, snapshotError], 'Doctor session persistence and ownership inspection failed.')
        }
        throw error
      }
      await captureWritten()
      if (!owned!.bytes.length) {
        throw new Error('Doctor session cache was replaced or did not contain the registered session; it was preserved.')
      }
    })()
    return persisting
  }
  const cleanup = createRetryableCleanup(async () => {
    closing = true
    await persisting?.catch(() => {})
    if (!owned) {
      return
    }
    const current = await readSnapshot(filePath)
    if (current && sameVersion(owned.stat, current.stat) && current.bytes.equals(owned.bytes)) {
      await fs.unlink(filePath).catch((error: NodeJS.ErrnoException) => {
        if (error.code !== 'ENOENT') {
          throw error
        }
      })
    }
  })
  return { persist, cleanup }
}
