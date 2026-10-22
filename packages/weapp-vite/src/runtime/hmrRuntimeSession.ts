import type { HmrRuntimeDecision } from './hmrRuntime'
import type { HmrRuntimeFallbackReason } from './hmrRuntimeCapabilities'
import { logger } from '../context/shared'
import { ClassicIdeConfigOwner } from './classicIdeConfig'

export type HmrRuntimePhase = 'stateful' | 'switching' | 'classic'
type ClassicRequestHandler = (reason: HmrRuntimeFallbackReason) => void | Promise<void>

export interface HmrOutputGeneration {
  readonly fingerprint: string
  readonly scopes: ReadonlyMap<string, ReadonlyMap<string, string>>
}

/** 一次 dev 命令共享的单向状态；Vite 配置重启只替换宿主绑定，不重置降级决定。 */
export interface HmrRuntimeSession {
  readonly classicIdeConfig: ClassicIdeConfigOwner
  readonly outputOwnership: Map<string, Map<string, Set<string>>>
  readonly outputGenerations: Map<string, HmrOutputGeneration>
  readonly phase: HmrRuntimePhase
  readonly fallback: HmrRuntimeFallbackReason | undefined
  resolve: (decision: HmrRuntimeDecision) => HmrRuntimeDecision
  requestClassic: (reason: HmrRuntimeFallbackReason) => void
  bindRequest: (handler: ClassicRequestHandler) => () => void
  markClassic: () => void
  whenSettled: () => Promise<void>
}

const sessions = new WeakMap<object, { session: HmrRuntimeSession, borrowed?: boolean }>()

export function createHmrRuntimeSession(): HmrRuntimeSession {
  let phase: HmrRuntimePhase = 'stateful'
  let fallback: HmrRuntimeFallbackReason | undefined
  let binding: { handler: ClassicRequestHandler } | undefined
  let dispatched = false
  let handlerSucceeded = false
  let scheduled = false
  let settled: ReturnType<typeof Promise.withResolvers<void>> | undefined

  function scheduleRequest() {
    if (scheduled || dispatched || !binding || phase !== 'switching') {
      return
    }
    scheduled = true
    queueMicrotask(() => {
      scheduled = false
      const current = binding
      if (dispatched || !current || phase !== 'switching' || !fallback) {
        return
      }
      dispatched = true
      // 请求者可能正在当前构建任务中；不得同步等待宿主关闭该任务自身。
      let task: void | Promise<void>
      try {
        task = current.handler(fallback)
      }
      catch (error) {
        settled?.reject(error)
        return
      }
      void Promise.resolve(task).then(() => {
        handlerSucceeded = true
        if (phase === 'classic') {
          settled?.resolve()
        }
      }, error => settled?.reject(error))
    })
  }

  return {
    classicIdeConfig: new ClassicIdeConfigOwner(),
    outputOwnership: new Map(),
    outputGenerations: new Map(),
    get phase() { return phase },
    get fallback() { return fallback },
    resolve: decision => fallback ? { ...decision, runtime: 'classic', reason: 'capability-fallback' } : decision,
    requestClassic(reason) {
      if (fallback) {
        return
      }
      fallback = { ...reason, files: reason.files ? [...reason.files] : undefined }
      phase = 'switching'
      settled = Promise.withResolvers<void>()
      // 宿主会在自己的错误通道报告失败；提前订阅避免未观察的拒绝。
      void settled.promise.catch(() => {})
      logger.warn(`[weapp-vite] HMR fallback ${JSON.stringify({ from: 'stateful-experimental', to: 'classic', reason: reason.code, message: reason.message })}`)
      scheduleRequest()
    },
    bindRequest(handler) {
      const current = { handler }
      binding = current
      scheduleRequest()
      return () => {
        if (binding === current) {
          binding = undefined
        }
      }
    },
    markClassic() {
      if (!fallback || phase === 'classic') {
        return
      }
      phase = 'classic'
      logger.info(`[weapp-vite] HMR classic ready ${JSON.stringify({ reason: fallback.code })}`)
      if (!dispatched || handlerSucceeded) {
        settled?.resolve()
      }
    },
    whenSettled: () => settled?.promise ?? Promise.resolve(),
  }
}

export function getHmrRuntimeSession(ctx: object): HmrRuntimeSession {
  let binding = sessions.get(ctx)
  if (!binding) {
    binding = { session: createHmrRuntimeSession() }
    sessions.set(ctx, binding)
  }
  return binding.session
}

/** 子插件共享命令决策和请求视图，但不能为自己的输出根再次接管 IDE 配置。 */
export function isBorrowedHmrRuntimeSession(ctx: object): boolean {
  return sessions.get(ctx)?.borrowed === true
}

export function attachHmrRuntimeSession(ctx: object, session: HmrRuntimeSession, options?: { borrowed: boolean }): () => void {
  const binding = { session, borrowed: options?.borrowed }
  sessions.set(ctx, binding)
  return () => {
    if (sessions.get(ctx) === binding) {
      sessions.delete(ctx)
    }
  }
}
