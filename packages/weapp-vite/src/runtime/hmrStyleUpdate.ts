import { randomUUID } from 'node:crypto'
import path from 'pathe'
import { isSourceStyleExtension } from '../platforms/sourceAssets'
import { normalizeFsResolvedId } from '../utils/resolvedId'

export type CompilerContentStyleReason = 'compiler-content' | 'tailwind-content'

export interface HmrStyleUpdatePlan {
  readonly id: string
  readonly full: boolean
  readonly sourceFiles: ReadonlySet<string>
  readonly styleFiles: ReadonlySet<string>
  readonly compilerContentOwners: ReadonlyMap<string, CompilerContentStyleReason>
  readonly cssImporterOwners: ReadonlySet<string>
}

interface StyleUpdateFacts {
  full?: boolean
  styleFiles?: Iterable<string>
  compilerContentOwners?: Iterable<readonly [string, CompilerContentStyleReason]>
  cssImporterOwners?: Iterable<string>
}

interface MutablePlan {
  id: string
  full: boolean
  sourceFiles: Set<string>
  styleFiles: Set<string>
  compilerContentOwners: Map<string, CompilerContentStyleReason>
  cssImporterOwners: Set<string>
}

interface StyleUpdateState {
  pending: Map<string, MutablePlan>
  pendingWithoutSource?: MutablePlan
  current?: { plan: MutablePlan, scoped: boolean }
}

const states = new WeakMap<object, StyleUpdateState>()

function stateFor(owner: object) {
  let state = states.get(owner)
  if (!state) {
    state = { pending: new Map() }
    states.set(owner, state)
  }
  return state
}

function mergeFacts(plan: MutablePlan, facts: StyleUpdateFacts, preserveExisting = false) {
  plan.full ||= facts.full === true
  for (const file of facts.styleFiles ?? []) {
    plan.styleFiles.add(normalizeFsResolvedId(file))
  }
  for (const [entry, reason] of facts.compilerContentOwners ?? []) {
    const owner = normalizeFsResolvedId(entry)
    if (!preserveExisting || !plan.compilerContentOwners.has(owner)) {
      plan.compilerContentOwners.set(owner, reason)
    }
  }
  for (const entry of facts.cssImporterOwners ?? []) {
    plan.cssImporterOwners.add(normalizeFsResolvedId(entry))
  }
}

/** 只固定本代样式交付事实；诊断标签及最终 CSS 缓存都不参与计划选择。 */
export function createHmrStyleUpdatePlan(files: Iterable<string>, facts: StyleUpdateFacts & { full?: boolean } = {}): HmrStyleUpdatePlan {
  const sourceFiles = new Set(Array.from(files, file => normalizeFsResolvedId(file)))
  const plan: MutablePlan = {
    id: randomUUID(),
    full: facts.full === true,
    sourceFiles,
    styleFiles: new Set([...sourceFiles].filter(file => isSourceStyleExtension(path.extname(file)) || /\.(?:stylus|pcss|postcss|sss)$/.test(file))),
    compilerContentOwners: new Map(),
    cssImporterOwners: new Set(),
  }
  mergeFacts(plan, facts)
  return plan
}

/** watch 事件只登记待消费事实；构建期间的新保存不能修改当前计划。 */
export function recordHmrStyleUpdate(owner: object, file: string, facts: StyleUpdateFacts = {}) {
  const state = stateFor(owner)
  const source = normalizeFsResolvedId(file)
  const pending = state.pending.get(source) ?? createHmrStyleUpdatePlan([source]) as MutablePlan
  mergeFacts(pending, facts)
  state.pending.set(source, pending)
}

export function getHmrStyleUpdatePlan(owner: object): HmrStyleUpdatePlan | undefined {
  return states.get(owner)?.current?.plan
}

function retryPlan(state: StyleUpdateState, plan: MutablePlan) {
  if (!plan.sourceFiles.size) {
    const pending = state.pendingWithoutSource ?? createHmrStyleUpdatePlan([]) as MutablePlan
    mergeFacts(pending, plan, true)
    state.pendingWithoutSource = pending
  }
  for (const file of plan.sourceFiles) {
    const pending = state.pending.get(file) ?? createHmrStyleUpdatePlan([file]) as MutablePlan
    mergeFacts(pending, plan, true)
    state.pending.set(file, pending)
  }
}

/** 一次性 snapshot 显式持有计划；finally 恢复外层所有权，包括失败路径。 */
export async function withHmrStyleUpdatePlan<T>(owner: object, plan: HmrStyleUpdatePlan, run: () => Promise<T>): Promise<T> {
  const state = stateFor(owner)
  const previous = state.current
  const current = { plan: plan as MutablePlan, scoped: true }
  if (state.pendingWithoutSource) {
    mergeFacts(current.plan, state.pendingWithoutSource, true)
    state.pendingWithoutSource = undefined
  }
  for (const file of plan.sourceFiles) {
    const pending = state.pending.get(file)
    if (pending) {
      mergeFacts(current.plan, pending)
      state.pending.delete(file)
    }
  }
  state.current = current
  try {
    return await run()
  }
  catch (error) {
    // 签名可能已在失败的原生构建中推进；保留交付事实供现有重放批次重试。
    retryPlan(state, current.plan)
    throw error
  }
  finally {
    if (state.current === current) {
      state.current = previous
    }
  }
}

/** 原生 watch 在 buildStart 接管已到达的事件，释放函数仅终结自己的一代。 */
export function beginHmrStyleUpdatePlan(owner: object, files: Iterable<string>, full = false): (success?: boolean) => void {
  const state = stateFor(owner)
  if (state.current) {
    return () => {}
  }
  const plan = createHmrStyleUpdatePlan(files, { full }) as MutablePlan
  if (state.pendingWithoutSource) {
    mergeFacts(plan, state.pendingWithoutSource)
    state.pendingWithoutSource = undefined
  }
  for (const [file, pending] of state.pending) {
    plan.sourceFiles.add(file)
    mergeFacts(plan, pending)
    state.pending.delete(file)
  }
  const current = { plan, scoped: false }
  state.current = current
  return (success = true) => {
    if (state.current === current) {
      if (!success) {
        retryPlan(state, current.plan)
      }
      state.current = undefined
    }
  }
}

/** 控制器在原生 END/ERROR 后结算，后置 write hook 失败不能提前记为成功。 */
export function settleHmrStyleUpdatePlan(owner: object, plan: HmrStyleUpdatePlan | undefined, success: boolean) {
  const state = states.get(owner)
  const current = state?.current
  if (state && current && current.plan === plan && !current.scoped) {
    if (!success) {
      retryPlan(state, current.plan)
    }
    state.current = undefined
  }
}

/** 构建图补充当前计划的真实样式归属，不覆盖源码语义已确认的编译器 owner。 */
export function mergeHmrStyleUpdatePlan(owner: object, facts: StyleUpdateFacts) {
  const plan = states.get(owner)?.current?.plan
  if (plan) {
    mergeFacts(plan, facts)
  }
}

/** 仅在本配置的 watcher 最终关闭时撤销尚未消费的事件。 */
export function clearPendingHmrStyleUpdates(owner: object) {
  const state = states.get(owner)
  if (state) {
    state.pending.clear()
    state.pendingWithoutSource = undefined
  }
}
