import type { Profiler } from 'node:inspector'
import { Session } from 'node:inspector/promises'

export interface CompilerCpuSession {
  connect: () => void
  disconnect: () => void
  post: (method: 'Profiler.enable' | 'Profiler.disable' | 'Profiler.setSamplingInterval' | 'Profiler.start' | 'Profiler.stop', params?: { interval: number }) => Promise<unknown>
}

function stoppedProfile(result: unknown): Profiler.Profile {
  if (!result || typeof result !== 'object' || !('profile' in result)
    || !result.profile || typeof result.profile !== 'object') {
    throw new Error('Inspector stop did not return a CPU profile')
  }
  return result.profile as Profiler.Profile
}

/** 单个诊断会话顺序采样完整编译；失败时保留主错误并释放 inspector。 */
export async function createCompilerCpuProfiler(createSession: () => CompilerCpuSession = () => new Session()) {
  const session = createSession()
  let connected = false
  try {
    session.connect()
    connected = true
    await session.post('Profiler.enable')
    await session.post('Profiler.setSamplingInterval', { interval: 1000 })
  }
  catch (error) {
    if (connected) {
      try {
        session.disconnect()
      }
      catch (cleanupError) {
        throw new AggregateError([error, cleanupError], 'CPU profiler setup and cleanup failed')
      }
    }
    throw error
  }

  let state: 'idle' | 'sampling' | 'failed' | 'disposed' = 'idle'
  let disposal: Promise<void> | undefined
  return {
    async measure<T>(compile: () => Promise<T>): Promise<{ value: T, profile: Profiler.Profile }> {
      if (state !== 'idle') {
        throw new Error(`CPU profiler cannot sample while ${state}`)
      }
      state = 'sampling'
      let reusable = true
      try {
        try {
          await session.post('Profiler.start')
        }
        catch (error) {
          reusable = false
          throw error
        }
        let value!: T
        let profile!: Profiler.Profile
        let primary: unknown
        let compileFailed = false
        let stopFailure: unknown
        let stopFailed = false
        try {
          value = await compile()
        }
        catch (error) {
          compileFailed = true
          primary = error
        }
        finally {
          try {
            profile = stoppedProfile(await session.post('Profiler.stop'))
          }
          catch (cleanupError) {
            reusable = false
            stopFailed = true
            stopFailure = cleanupError
          }
        }
        if (stopFailed) {
          if (compileFailed) {
            throw new AggregateError([primary, stopFailure], 'Compilation and CPU profiler stop failed')
          }
          throw stopFailure
        }
        if (compileFailed) {
          throw primary
        }
        return { value, profile }
      }
      finally {
        state = reusable ? 'idle' : 'failed'
      }
    },
    async dispose(): Promise<void> {
      if (state === 'sampling') {
        throw new Error('CPU profiler cannot dispose while sampling')
      }
      if (disposal) {
        return disposal
      }
      state = 'disposed'
      disposal = (async () => {
        let primary: unknown
        let disableFailed = false
        try {
          await session.post('Profiler.disable')
        }
        catch (error) {
          primary = error
          disableFailed = true
        }
        try {
          session.disconnect()
        }
        catch (cleanupError) {
          if (disableFailed) {
            throw new AggregateError([primary, cleanupError], 'CPU profiler disable and disconnect failed')
          }
          throw cleanupError
        }
        if (disableFailed) {
          throw primary
        }
      })()
      return disposal
    },
  }
}

function profileTree(profile: Profiler.Profile) {
  if (!profile || !Array.isArray(profile.nodes) || !profile.nodes.length || !Array.isArray(profile.samples)
    || !Number.isFinite(profile.startTime) || !Number.isFinite(profile.endTime) || profile.endTime < profile.startTime) {
    throw new Error('CPU profile requires nodes, samples and a valid original interval')
  }
  const nodes = new Map<number, Profiler.ProfileNode>()
  for (const node of profile.nodes) {
    const frame = node?.callFrame
    if (!node || !Number.isSafeInteger(node.id) || node.id <= 0 || nodes.has(node.id)
      || !frame || typeof frame.url !== 'string' || typeof frame.functionName !== 'string' || typeof frame.scriptId !== 'string'
      || !Number.isSafeInteger(frame.lineNumber) || frame.lineNumber < -1
      || !Number.isSafeInteger(frame.columnNumber) || frame.columnNumber < -1
      || (node.children !== undefined && !Array.isArray(node.children))) {
      throw new Error('CPU profile contains invalid or duplicate nodes')
    }
    nodes.set(node.id, node)
  }
  const parents = new Set<number>()
  for (const node of nodes.values()) {
    for (const child of node.children ?? []) {
      if (!nodes.has(child) || parents.has(child) || child === node.id) {
        throw new Error('CPU profile contains dangling, duplicate or shared children')
      }
      parents.add(child)
    }
  }
  const roots = [...nodes.keys()].filter(id => !parents.has(id))
  if (roots.length !== 1) {
    throw new Error('CPU profile must contain exactly one root')
  }
  const visited = new Set<number>()
  const pending = [roots[0]!]
  while (pending.length) {
    const id = pending.pop()!
    if (visited.has(id)) {
      throw new Error('CPU profile contains a cycle')
    }
    visited.add(id)
    for (const child of nodes.get(id)!.children ?? []) {
      pending.push(child)
    }
  }
  if (visited.size !== nodes.size || profile.samples.some(sample => !Number.isSafeInteger(sample) || !nodes.has(sample))) {
    throw new Error('CPU profile contains disconnected nodes or dangling samples')
  }
  return { root: roots[0]!, nodes, samples: profile.samples }
}

export interface CountsOnlyCpuProfile extends Profiler.Profile {
  aggregateKind: 'counts-only'
  sourceProfileCount: number
}

/** 保留各棵采样树及原始帧，只合并计数；零时间轴与缺失 timeDeltas 明确禁止推断耗时。 */
export function mergeCpuProfiles(profiles: Profiler.Profile[]): CountsOnlyCpuProfile {
  if (!Array.isArray(profiles) || profiles.length === 0) {
    throw new Error('CPU profile merge requires at least one profile')
  }
  const root: Profiler.ProfileNode = {
    id: 1,
    callFrame: { functionName: '(root)', scriptId: '0', url: '', lineNumber: -1, columnNumber: -1 },
    children: [],
    hitCount: 0,
  }
  const nodes = [root]
  const samples: number[] = []
  for (const profile of profiles) {
    const tree = profileTree(profile)
    const ids = new Map([...tree.nodes.keys()].map((id, index) => [id, nodes.length + index + 1]))
    root.children!.push(ids.get(tree.root)!)
    for (const node of tree.nodes.values()) {
      nodes.push({
        ...node,
        id: ids.get(node.id)!,
        callFrame: { ...node.callFrame },
        ...(node.children === undefined ? {} : { children: node.children.map(id => ids.get(id)!) }),
        ...(node.positionTicks === undefined ? {} : { positionTicks: node.positionTicks.map(tick => ({ ...tick })) }),
      })
    }
    for (const sample of tree.samples) {
      samples.push(ids.get(sample)!)
    }
  }
  if (!samples.length) {
    throw new Error('CPU profile aggregate has no samples')
  }
  return { aggregateKind: 'counts-only', sourceProfileCount: profiles.length, nodes, samples, startTime: 0, endTime: 0 }
}
