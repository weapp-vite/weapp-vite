import type { ChokidarOptions } from 'chokidar'
import type { Stats } from 'node:fs'
import { stat } from 'node:fs/promises'
import process from 'node:process'
import path from 'pathe'

export interface PhysicalViteWatchPlan {
  root: string
  targets: string[]
  options: ChokidarOptions
  identity: { dev: number, ino: number }
  reachable: (file: string) => boolean
}

function code(error: unknown) {
  return error && typeof error === 'object' && 'code' in error ? error.code : undefined
}

function missing(error: unknown) {
  return code(error) === 'ENOENT' || code(error) === 'ENOTDIR'
}

function relativeDepth(parent: string, file: string) {
  const relative = path.relative(parent, file)
  if (relative === '..' || relative.startsWith('../') || path.isAbsolute(relative)) {
    return undefined
  }
  return relative.split('/').filter(Boolean).length
}

function validDepth(depth: ChokidarOptions['depth']): depth is number {
  return typeof depth === 'number' && Number.isSafeInteger(depth) && depth >= 0
}

/** 物理根仅承担遍历入口；逻辑目标保留原深度、忽略规则和动态排除语义。 */
function physicalScope(root: string, targets: string[], options: ChokidarOptions, accepts: (file: string) => boolean) {
  const ignored = options.ignored
  if (ignored !== undefined && typeof ignored !== 'function') {
    throw new TypeError('Vite physical watcher requires a compiled ignored function')
  }
  const absolute = (file: string) => path.resolve(options.cwd ?? process.cwd(), file)
  const depth = options.depth
  const pruned = new Set<string>()
  const includes = (target: string, candidate: string) => {
    const distance = relativeDepth(target, candidate)
    return distance !== undefined && (!validDepth(depth) || distance <= depth + 1)
  }
  const blocked = (target: string, candidate: string, rechecking: boolean) => {
    let current = candidate
    while (relativeDepth(target, current) !== undefined) {
      if (pruned.has(current) && (!rechecking || current !== candidate)) {
        return true
      }
      if (current === target) {
        break
      }
      current = path.dirname(current)
    }
    return false
  }
  const reachable = (file: string, rechecking = false) => {
    const candidate = absolute(file)
    return accepts(candidate) && targets.some(target => accepts(target) && includes(target, candidate) && !blocked(target, candidate, rechecking))
  }
  return {
    reachable,
    options: {
      ...options,
      depth: validDepth(depth) ? Math.min(Number.MAX_SAFE_INTEGER, depth + Math.max(...targets.map(target => relativeDepth(root, target)!))) : depth,
      ignored(file: string, stats?: Stats) {
        const candidate = absolute(file)
        const activeTargets = targets.filter(accepts)
        let rechecking = false
        if (activeTargets.some(target => includes(target, candidate))) {
          if (ignored?.(candidate, stats)) {
            pruned.add(candidate)
          }
          else if (stats) {
            pruned.delete(candidate)
          }
          else {
            // 无 stats 的初检允许本路径重新取样；祖先剪枝与事件归属仍保留到真实 stats 更新。
            rechecking = true
          }
        }
        // 显式子目标只放行自己的祖先路线，不扩大其他逻辑目标被剪枝的旁支。
        const ancestor = activeTargets.some(target => target !== candidate && relativeDepth(candidate, target) !== undefined)
        return !ancestor && !reachable(candidate, rechecking)
      },
    },
  }
}

/** 仅订阅现存目录，避免为每个缺失逻辑文件创建祖先 target owner。 */
export async function planPhysicalViteWatchTargets(targets: string[], options: ChokidarOptions, accepts: (file: string) => boolean, active: () => boolean): Promise<PhysicalViteWatchPlan[]> {
  const plans = new Map<string, PhysicalViteWatchPlan>()
  const absolute = (file: string) => path.resolve(options.cwd ?? process.cwd(), file)
  const ignored = options.ignored
  if (ignored !== undefined && typeof ignored !== 'function') {
    throw new TypeError('Vite physical watcher requires a compiled ignored function')
  }
  for (const target of new Set(targets.map(absolute))) {
    if (!active()) {
      return []
    }
    if (!accepts(target) || ignored?.(target, undefined)) {
      continue
    }
    let root = path.dirname(target)
    while (active()) {
      let stats: Stats
      try {
        stats = await stat(root)
      }
      catch (error) {
        if (!missing(error)) {
          if (options.ignorePermissionErrors && (code(error) === 'EACCES' || code(error) === 'EPERM')) {
            break
          }
          throw error
        }
        if (!active()) {
          return []
        }
        const parent = path.dirname(root)
        if (parent === root) {
          throw error
        }
        root = parent
        continue
      }
      if (!active()) {
        return []
      }
      if (stats.isDirectory()) {
        if (accepts(target)) {
          const plan = plans.get(root)
          if (plan) {
            plan.targets.push(target)
          }
          else {
            plans.set(root, { root, targets: [target], options, identity: { dev: stats.dev, ino: stats.ino }, reachable: () => false })
          }
        }
        break
      }
      const parent = path.dirname(root)
      if (parent === root) {
        throw new TypeError('Vite physical watcher could not find a directory ancestor')
      }
      root = parent
    }
  }
  if (!active()) {
    return []
  }
  const candidates = [...plans.values()]
    .map(plan => ({ ...plan, targets: plan.targets.filter(accepts) }))
    .filter(plan => plan.targets.length > 0)
  // 同组重叠物理根只保留最外层，避免一个事件由多个 backing owner 重复交付。
  const roots = candidates.filter(plan => !candidates.some(other => other !== plan && relativeDepth(other.root, plan.root) !== undefined))
  return roots.flatMap((plan) => {
    const targets = candidates
      .filter(candidate => relativeDepth(plan.root, candidate.root) !== undefined)
      .flatMap(candidate => candidate.targets)
    return targets.length ? [{ ...plan, targets, ...physicalScope(plan.root, targets, options, accepts) }] : []
  })
}

/** 在派发订阅前核对目录身份；规划结果不代表后续原子注册保证。 */
export async function isPhysicalViteWatchPlanCurrent(plan: PhysicalViteWatchPlan): Promise<boolean> {
  try {
    const stats = await stat(plan.root)
    return stats.isDirectory() && stats.dev === plan.identity.dev && stats.ino === plan.identity.ino
  }
  catch (error) {
    if (missing(error)) {
      return false
    }
    throw error
  }
}
