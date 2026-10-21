// eslint-disable-next-line e18e/ban-dependencies -- 单个受持有的 JXA 进程复用冷启动，不创建嵌套子进程。
import { execa } from 'execa'
import { darwinSnapshotScript } from './darwinSnapshotScript'
import { inspectorLines } from './inspectorProtocol'

export interface ResourceProcessFrame {
  stdout: string
  inspectorPid: number
}

export interface ResourceProcessSnapshot {
  initial: ResourceProcessFrame
  paths: Map<number, string | null>
  after: ResourceProcessFrame
}

export type ResourceKernelPathReader = (pids: number[]) => Promise<Map<number, string | null>>

function remaining(deadline: number) {
  const value = Math.floor(deadline - Date.now())
  if (value <= 0) {
    throw new Error('Resource sampling exhausted its shared process inspection budget.')
  }
  return value
}

/** 每个响应只有一个既定阶段和精确身份集合，拒绝重复、缺失和额外身份。 */
export function parseDarwinKernelResponse(line: string, pids: number[]) {
  const response: unknown = JSON.parse(line)
  if (!response || typeof response !== 'object' || Object.keys(response).length !== 2
    || !('phase' in response) || response.phase !== 'paths' || !('paths' in response) || !Array.isArray(response.paths)) {
    throw new Error('Resource sampling received an invalid kernel response.')
  }
  const paths = new Map<number, string | null>()
  const entries: unknown[] = response.paths
  for (const entry of entries) {
    if (!entry || typeof entry !== 'object' || Object.keys(entry).length !== 2
      || !('pid' in entry) || typeof entry.pid !== 'number' || !Number.isSafeInteger(entry.pid) || entry.pid <= 0
      || !('executable' in entry) || (entry.executable !== null && typeof entry.executable !== 'string') || paths.has(entry.pid)) {
      throw new Error('Resource sampling received invalid kernel process paths.')
    }
    paths.set(entry.pid, entry.executable)
  }
  if (paths.size !== pids.length || pids.some(pid => !paths.has(pid))) {
    throw new Error('Resource sampling received incomplete batch process identities.')
  }
  return paths
}

export function readDarwinSnapshot(deadline: number, readFrame: () => Promise<ResourceProcessFrame>): Promise<ResourceProcessSnapshot>
export function readDarwinSnapshot<T>(deadline: number, readFrame: () => Promise<ResourceProcessFrame>, consume: (snapshot: ResourceProcessSnapshot, readPaths: ResourceKernelPathReader) => Promise<T>): Promise<T>
/** 预热先于 RSS 锚点；同一 helper 贯穿有界后续轮次，且不创建自己的 ps。 */
export async function readDarwinSnapshot<T>(
  deadline: number,
  readFrame: () => Promise<ResourceProcessFrame>,
  consume?: (snapshot: ResourceProcessSnapshot, readPaths: ResourceKernelPathReader) => Promise<T>,
) {
  const child = execa('/usr/bin/osascript', ['-l', 'JavaScript', '-e', darwinSnapshotScript], {
    timeout: remaining(deadline),
    reject: false,
    env: { LC_ALL: 'C' },
  })
  const owner = child.nodeChildProcess
  const terminal = Promise.resolve(child)
  const lines = inspectorLines(owner.stdout, terminal)
  let outcome: ResourceProcessSnapshot | T | undefined
  let failure: unknown
  let closed = false
  let requesting = false
  let requestCount = 0
  const readPaths: ResourceKernelPathReader = async (pids) => {
    if (closed || requesting || requestCount >= 3 || !owner.stdin || owner.stdin.destroyed || owner.stdin.writableEnded) {
      throw new Error('Resource sampling inspector request is unavailable.')
    }
    if (new Set(pids).size !== pids.length || pids.some(pid => !Number.isSafeInteger(pid) || pid <= 0)) {
      throw new Error('Resource sampling received an invalid process identity request.')
    }
    const timeout = remaining(deadline)
    lines.assertComplete()
    requesting = true
    requestCount++
    try {
      const response = lines.next(timeout)
      const written = new Promise<void>((resolve, reject) => {
        owner.stdin!.write(`${JSON.stringify({ pids })}\n`, error => error ? reject(error) : resolve())
      })
      const [line] = await Promise.all([response, written])
      const paths = parseDarwinKernelResponse(line, pids)
      lines.assertComplete()
      return paths
    }
    finally {
      requesting = false
    }
  }
  try {
    // ready 另有上限，不能把整个共享预算都花在等待 helper 冷启动。
    const ready: unknown = JSON.parse(await lines.next(Math.min(5_000, remaining(deadline))))
    if (!ready || typeof ready !== 'object' || Object.keys(ready).length !== 1 || !('phase' in ready) || ready.phase !== 'ready') {
      throw new Error('Resource sampling received an invalid inspector readiness response.')
    }
    lines.assertComplete()
    const initial = await readFrame()
    const pids = initial.stdout.trim().split(/\r?\n/).map((line) => {
      const match = /^\s*(\d+)\s/.exec(line)
      if (!match) {
        throw new Error('Resource sampling received an invalid process identity.')
      }
      return Number(match[1])
    }).filter(pid => pid !== initial.inspectorPid)
    const paths = await readPaths(pids)
    const after = await readFrame()
    const snapshot = { initial, paths, after }
    outcome = consume ? await consume(snapshot, readPaths) : snapshot
  }
  catch (error) {
    failure = error
  }
  closed = true
  // 无论首帧、路径或后验 ps 在何处失败，都结束 stdin 并等待手中 child 退出。
  try {
    if (owner.stdin && !owner.stdin.destroyed && !owner.stdin.writableEnded) {
      owner.stdin.end()
    }
  }
  catch (error) {
    failure ??= error
  }
  if (failure && owner.pid && owner.exitCode === null && owner.signalCode === null) {
    try {
      child.kill('SIGKILL')
    }
    catch (error) {
      failure = new AggregateError([failure, error], 'Resource sampling inspector cleanup failed.')
    }
  }
  try {
    const result = await terminal
    if (!failure && (result.exitCode !== 0 || result.timedOut || result.signal || result.stderr?.trim())) {
      failure = new Error('Resource sampling could not read the warmed kernel process inventory.')
    }
    if (!failure) {
      lines.assertComplete()
    }
  }
  catch (error) {
    failure ??= error
  }
  finally {
    lines.dispose()
  }
  if (failure) {
    throw failure
  }
  return outcome!
}
