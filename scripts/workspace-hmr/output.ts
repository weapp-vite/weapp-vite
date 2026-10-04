import { createHash } from 'node:crypto'
import { access, readdir, readFile, stat } from 'node:fs/promises'
import path from 'node:path'
import { setTimeout as sleep } from 'node:timers/promises'

export interface DistFileSnapshot {
  hash: string
  size: number
}

interface InitialBuildProcess {
  waitFor: <T>(task: Promise<T>, description: string) => Promise<T>
  waitForInitialBuild: (timeoutMs?: number) => Promise<string>
}

function isReplacedOutput(error: unknown) {
  return error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')
}

export async function listFiles(root: string, allowMissingRoot = true): Promise<string[]> {
  try {
    await access(root)
  }
  catch (error) {
    if (allowMissingRoot && isReplacedOutput(error)) {
      return []
    }
    throw error
  }
  const result: string[] = []
  const entries = await readdir(root, { withFileTypes: true })
  for (const entry of entries) {
    const filePath = path.join(root, entry.name)
    if (entry.isDirectory()) {
      if (['node_modules', 'dist', '.weapp-vite', '.turbo', '.tmp'].includes(entry.name)) {
        continue
      }
      result.push(...await listFiles(filePath, false))
    }
    else if (entry.isFile()) {
      result.push(filePath)
    }
  }
  return result.sort((left, right) => left.localeCompare(right))
}

export async function snapshotDist(distRoot: string) {
  const snapshot = new Map<string, DistFileSnapshot>()
  for (const filePath of await listFiles(distRoot, false)) {
    const fileStat = await stat(filePath)
    if (!fileStat.isFile()) {
      continue
    }
    const content = await readFile(filePath)
    snapshot.set(path.relative(distRoot, filePath).replaceAll('\\', '/'), {
      hash: createHash('sha256').update(content).digest('hex'),
      size: fileStat.size,
    })
  }
  return snapshot
}

export async function waitForStableDistSnapshot(distRoot: string, stableMs: number, timeoutMs: number, signal?: AbortSignal) {
  const startedAt = Date.now()
  let previousSignature: string | undefined
  let stableStartedAt = Date.now()

  while (Date.now() - startedAt < timeoutMs) {
    signal?.throwIfAborted()
    let snapshot: Map<string, DistFileSnapshot>
    try {
      snapshot = await snapshotDist(distRoot)
    }
    catch (error) {
      if (!isReplacedOutput(error)) {
        throw error
      }
      // 后续合法构建也可能替换目录；整轮观察作废，不能拼出缺文件的快照。
      previousSignature = undefined
      stableStartedAt = Date.now()
      await sleep(Math.min(250, stableMs), undefined, { signal })
      continue
    }
    signal?.throwIfAborted()
    if (Date.now() - startedAt >= timeoutMs) {
      break
    }
    const signature = [...snapshot.entries()]
      .map(([filePath, value]) => `${filePath}:${value.hash}:${value.size}`)
      .join('\n')

    if (snapshot.size > 0 && signature === previousSignature) {
      if (Date.now() - stableStartedAt >= stableMs) {
        return snapshot
      }
    }
    else {
      previousSignature = signature
      stableStartedAt = Date.now()
    }

    await sleep(Math.min(250, stableMs), undefined, { signal })
  }

  throw new Error('Timed out waiting for workspace HMR output to stabilize')
}

export async function waitForInitialDistSnapshot(dev: InitialBuildProcess, distRoot: string, stableMs: number, timeoutMs: number) {
  const deadline = Date.now() + timeoutMs
  // 首个可见文件不是发布屏障；CLI 完成信号已等待主构建和 npm 发布任务。
  await dev.waitForInitialBuild(timeoutMs)
  await access(path.join(distRoot, 'app.json'))
  const remainingMs = deadline - Date.now()
  if (remainingMs <= 0) {
    throw new Error('Timed out waiting for initial workspace HMR output')
  }
  const observation = new AbortController()
  try {
    const snapshot = await dev.waitFor(waitForStableDistSnapshot(distRoot, stableMs, remainingMs, observation.signal), 'initial workspace HMR output')
    if (!snapshot.has('app.json')) {
      throw new Error('Initial workspace HMR output is missing app.json')
    }
    return snapshot
  }
  finally {
    observation.abort()
  }
}
