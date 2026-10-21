import { createHash } from 'node:crypto'
import { fs } from '@weapp-core/shared/node'
import path from 'pathe'
import { inspectVendorMembers } from './scanner'

type PublicationSnapshot = ReadonlyMap<string, string>

async function collectDistJsFiles(distRoot: string) {
  const files = await fs.readdir(distRoot, { recursive: true })
  return files
    .filter((file): file is string => typeof file === 'string' && file.endsWith('.js'))
    .map(file => file.replaceAll('\\', '/'))
    .sort()
}

/** 枚举和读取必须属于同一文件集合；ENOENT 表示原生 publication 尚未稳定。 */
export async function captureVendorPublicationSnapshot(distRoot: string, signal?: AbortSignal): Promise<PublicationSnapshot | undefined> {
  try {
    signal?.throwIfAborted()
    const files = await collectDistJsFiles(distRoot)
    const snapshot = new Map<string, string>()
    for (const file of files) {
      signal?.throwIfAborted()
      snapshot.set(file, await fs.readFile(path.join(distRoot, file), { encoding: 'utf8', signal }))
    }
    const finalFiles = await collectDistJsFiles(distRoot)
    signal?.throwIfAborted()
    if (files.length !== finalFiles.length || files.some((file, index) => file !== finalFiles[index])) {
      return undefined
    }
    return snapshot
  }
  catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return undefined
    }
    throw error
  }
}

/** 连续两个完整内容快照一致后检查引用；真实 I/O 错误不能作为构建竞争吞掉。 */
export async function waitForVendorMembersIntact(distRoot: string, timeoutMs = 90_000) {
  const deadline = Date.now() + timeoutMs
  const reads = new AbortController()
  let previousHash: string | undefined
  let lastIssue = 'no complete publication observed'
  let lastMissing: Record<string, string[]> = {}
  const timeoutError = () => new Error(`Timed out waiting for vendor members to stay exported: ${JSON.stringify({ issue: lastIssue, missing: lastMissing })}`)
  if (timeoutMs <= 0) {
    throw timeoutError()
  }
  const budget = Promise.withResolvers<never>()
  const timer = setTimeout(() => {
    budget.reject(timeoutError())
    reads.abort()
  }, Math.max(0, deadline - Date.now()))

  try {
    while (Date.now() < deadline) {
      const snapshot = await Promise.race([captureVendorPublicationSnapshot(distRoot, reads.signal), budget.promise])
      if (Date.now() >= deadline) {
        throw timeoutError()
      }
      if (!snapshot || !snapshot.size) {
        previousHash = undefined
        lastIssue = snapshot ? 'publication contains no JavaScript files' : 'publication changed while reading'
      }
      else {
        const hash = createHash('sha256').update(JSON.stringify([...snapshot])).digest('hex')
        const stable = hash === previousHash
        previousHash = hash
        if (stable) {
          const inspection = inspectVendorMembers(snapshot, distRoot)
          lastMissing = inspection.missingByFile
          if (inspection.referencedMembers && !Object.keys(lastMissing).length) {
            if (Date.now() >= deadline) {
              throw timeoutError()
            }
            return lastMissing
          }
          lastIssue = inspection.referencedMembers ? 'vendor modules or members are missing' : 'publication contains no vendor member references'
        }
        else {
          lastIssue = 'publication content is not stable'
        }
      }
      const remainingMs = deadline - Date.now()
      if (remainingMs > 0) {
        await Promise.race([new Promise(resolve => setTimeout(resolve, Math.min(250, remainingMs))), budget.promise])
      }
    }
    throw timeoutError()
  }
  finally {
    clearTimeout(timer)
    reads.abort()
  }
}
