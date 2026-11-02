import { WEAPP_VITE_CLASSIC_SETTLEMENT_KEY } from '@weapp-core/constants'

interface ClassicSettlementState {
  build: Promise<unknown>
  completion: Promise<unknown>
  profile?: Promise<unknown>
  pending: boolean
}

interface ClassicSettlementOptions {
  flush: () => void
  read: () => ClassicSettlementState
  isActive: () => boolean
}

interface ClassicSettlementBinding {
  whenSettled: () => Promise<void>
  retire: () => void
}

/** 宿主只转发编译上下文当前代的观察绑定，不取得该代的关闭所有权。 */
export function linkClassicSettlement(owner: object, target: object): () => void {
  if (owner === target) {
    return () => {}
  }
  const key = Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)
  const readBinding = () => Reflect.get(owner, key) as ClassicSettlementBinding | undefined
  Object.defineProperty(target, key, { get: readBinding, configurable: true })
  return () => {
    if (Object.getOwnPropertyDescriptor(target, key)?.get === readBinding) {
      Reflect.deleteProperty(target, key)
    }
  }
}

/** 将 classic 发布观察绑定到当前编译代。 */
export function bindClassicSettlement(owner: object, options: ClassicSettlementOptions): ClassicSettlementBinding {
  const key = Symbol.for(WEAPP_VITE_CLASSIC_SETTLEMENT_KEY)
  const retirementWaiters = new Set<ReturnType<typeof Promise.withResolvers<void>>>()
  const retirementError = new Error('Classic build generation was retired before settlement')
  let retired = false
  const binding: ClassicSettlementBinding = {
    async whenSettled() {
      // 只记录本次等待实际观察到的失败，不跨发布保留已完成任务或错误。
      const failures = new Set<unknown>()
      let flushFailed = false
      const retirement = Promise.withResolvers<void>()
      retirementWaiters.add(retirement)
      const ensureActive = () => {
        if (retired || Reflect.get(owner, key) !== binding || !options.isActive()) {
          binding.retire()
          throw retirementError
        }
      }
      const capture = () => {
        ensureActive()
        try {
          options.flush()
        }
        catch (error) {
          failures.add(error)
          flushFailed = true
        }
        ensureActive()
        return options.read()
      }
      try {
        let current = capture()
        while (true) {
          const tasks = [current.build, current.completion, ...(current.profile ? [current.profile] : [])]
          const observed = tasks.map(task => task.catch((error) => {
            failures.add(error)
            throw error
          }))
          // 退休只终结观察；原生任务仍由各自 owner 排空，不反向等待新编译代。
          await Promise.race([Promise.allSettled(observed), retirement.promise])
          ensureActive()
          // flush 失败后只排空已捕获的发布；不能重试同一待批次形成微任务忙循环。
          if (flushFailed) {
            break
          }
          const next = capture()
          if (current.build === next.build && current.completion === next.completion
            && current.profile === next.profile && !next.pending) {
            break
          }
          current = next
        }
      }
      catch (error) {
        failures.add(error)
      }
      finally {
        retirementWaiters.delete(retirement)
      }
      const errors = [...failures]
      if (errors.length === 1) {
        throw errors[0]
      }
      if (errors.length) {
        throw new AggregateError(errors, 'Classic build settlement failed', { cause: errors[0] })
      }
    },
    retire() {
      if (retired) {
        return
      }
      retired = true
      if (Reflect.get(owner, key) === binding) {
        Reflect.deleteProperty(owner, key)
      }
      for (const waiter of retirementWaiters) {
        waiter.resolve()
      }
      retirementWaiters.clear()
    },
  }
  const previous = Reflect.get(owner, key) as ClassicSettlementBinding | undefined
  previous?.retire()
  Object.defineProperty(owner, key, { value: binding, configurable: true })
  return binding
}
