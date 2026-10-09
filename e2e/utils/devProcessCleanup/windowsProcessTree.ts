import type { ManagedWechatHostIdentity } from '../../../packages/weapp-ide-cli/src/devtoolsProjectOwnership/types'

export interface ProcessEntry {
  pid: number
  ppid: number
  identity?: ManagedWechatHostIdentity
  started?: string
}

export interface DevProcessCandidate {
  pid: number
  started?: string
  executable?: string
}

/** 根在发现期间退出时，候选后代只保留为待核验记录，不获得终止权限。 */
export class UnconfirmedDevProcessTreeError extends Error {
  readonly pids: readonly number[]

  constructor(readonly candidates: readonly DevProcessCandidate[], options?: ErrorOptions) {
    super('Dev process identity could not be verified; descendant ownership remains unconfirmed.', options)
    this.pids = candidates.map(candidate => candidate.pid)
  }
}

function startedAt(entry: ProcessEntry) {
  const value = entry.started ?? entry.identity?.started
  if (!value) {
    return undefined
  }
  // CIM 的 UTC round-trip 格式保留 100ns；Date.parse 单独使用会丢失同毫秒内的先后关系。
  const match = /^(\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2})\.(\d{7})Z$/.exec(value)
  const milliseconds = match ? Date.parse(`${match[1]}.000Z`) : Number.NaN
  if (!match || !Number.isFinite(milliseconds) || new Date(milliseconds).toISOString() !== `${match[1]}.000Z`) {
    throw new Error('Dev process creation time could not be verified.')
  }
  return BigInt(milliseconds) * 10_000n + BigInt(match[2]!)
}

/** 只把时间上属于当前父进程代次的 PPID 边纳入树；旧父 PID 被复用不授予后代权限。 */
export async function collectWindowsProcessTree(
  rootPid: number,
  entries: ProcessEntry[],
  reinspect: (pids: number[]) => Promise<ProcessEntry[]>,
) {
  const resolvedEntries = new Map<number, ProcessEntry>()
  const candidates = () => {
    const pending = new Map<number, ProcessEntry>()
    const discover = (pid: number) => {
      const parent = resolvedEntries.get(pid) ?? entries.find(entry => entry.pid === pid)
      for (const original of entries.filter(entry => entry.ppid === pid)) {
        const entry = resolvedEntries.get(original.pid) ?? original
        let older = false
        try {
          const parentStarted = parent && startedAt(parent)
          const childStarted = startedAt(entry)
          older = parentStarted !== undefined && childStarted !== undefined && childStarted < parentStarted
        }
        catch {
          // 诊断候选允许缺失或非法时间，只有 visit 完整核验后才授予终止权限。
        }
        if (!older && entry.pid !== rootPid && !pending.has(entry.pid)) {
          pending.set(entry.pid, entry)
          discover(entry.pid)
        }
      }
    }
    discover(rootPid)
    return pending
  }
  const unconfirmed = (cause: unknown) => new UnconfirmedDevProcessTreeError([...candidates().values()].map(entry => ({
    pid: entry.pid,
    started: entry.started ?? entry.identity?.started,
    executable: entry.identity?.executable,
  })), { cause })
  const seen = new Set<number>()
  const result: ProcessEntry[] = []
  const visit = async (original: ProcessEntry, parentStarted?: bigint) => {
    const initialStarted = startedAt(original)
    if (parentStarted !== undefined && initialStarted !== undefined && initialStarted < parentStarted) {
      return
    }
    let entry = original
    let exited = false
    if (!entry.identity || initialStarted === undefined) {
      const current = await reinspect([entry.pid])
      if (current.length > 1) {
        throw new Error('Dev process identity inspection returned duplicate candidates.')
      }
      if (current.length === 0) {
        exited = true
      }
      else {
        const fresh = current[0]!
        if (fresh.pid !== entry.pid || fresh.ppid !== entry.ppid || !fresh.identity
          || (initialStarted !== undefined && startedAt(fresh) !== initialStarted)) {
          throw new Error('Dev process candidate changed during identity inspection.')
        }
        entry = fresh
        resolvedEntries.set(entry.pid, entry)
      }
    }
    const started = startedAt(entry)
    const children = entries.filter(candidate => candidate.ppid === entry.pid)
    if (started === undefined) {
      if (exited && children.length === 0) {
        return
      }
      throw new Error('Dev process parent generation is unknown; descendants remain unconfirmed.')
    }
    if (parentStarted !== undefined && started < parentStarted) {
      return
    }
    if (seen.has(entry.pid)) {
      throw new Error('Dev process snapshot contains an unresolved parent cycle.')
    }
    seen.add(entry.pid)
    for (const child of children) {
      await visit(child, started)
    }
    if (!exited) {
      result.push(entry)
    }
  }
  try {
    const roots = entries.filter(entry => entry.pid === rootPid)
    if (roots.length !== 1) {
      if (roots.length === 0 && candidates().size === 0) {
        return result
      }
      throw new Error('Dev process root generation could not be verified.')
    }
    await visit(roots[0]!)
    return result
  }
  catch (error) {
    throw unconfirmed(error)
  }
}
