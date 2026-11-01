import type { ChokidarOptions, FSWatcher } from 'chokidar'
import type { Stats } from 'node:fs'
import type { PhysicalViteWatchPlan } from './physical'
import process from 'node:process'
import chokidar from 'chokidar'
import path from 'pathe'
import { createSidecarWatcherReadiness } from '../sidecarReadiness'
import { throwViteAdapterErrors } from './errors'
import { isPhysicalViteWatchPlanCurrent, planPhysicalViteWatchTargets } from './physical'

type Readiness = 'ready' | 'closed'

export interface ViteWatcherCloseFailure {
  targets: string[]
  error: unknown
  lateErrors: unknown[]
}

interface Callbacks {
  accepts: (file: string) => boolean
  event: (name: string, file: string, stats?: Stats) => void
  raw: (...args: unknown[]) => void
  options: (options: FSWatcher['options']) => void
  pending: (registration: Promise<Readiness>) => void
}

interface Subscription {
  plan: PhysicalViteWatchPlan
  watcher: FSWatcher
  ready: Promise<Readiness>
  close: () => Promise<void>
}

/** 每个逻辑 add 独立持有目录订阅，根目录失效时先取消旧代再重新规划。 */
export function createPhysicalViteWatcherGroup(targets: string[], options: ChokidarOptions, callbacks: Callbacks) {
  const subscriptions: Subscription[] = []
  const registrations = new Set<Promise<Readiness>>()
  const failures = new Map<Subscription, ViteWatcherCloseFailure>()
  let closed = false
  let generation = 0
  let closing: Promise<void> | undefined
  const absolute = (file: string) => path.resolve(options.cwd ?? process.cwd(), file)
  const active = (current: number) => !closed && current === generation
  const retire = (retiring: Subscription[]) => Promise.allSettled(retiring.map((subscription) => {
    // 同步进入 backing close，阻止本次 unlinkDir 回调后的原生 missing-path 重订阅。
    return subscription.close()
  })).then((results) => {
    results.forEach((result, index) => {
      const subscription = retiring[index]!
      subscription.watcher.removeAllListeners()
      if (result.status === 'rejected') {
        const failure = { targets: [...targets], error: result.reason, lateErrors: [] as unknown[] }
        failures.set(subscription, failure)
        subscription.watcher.on('error', error => failure.lateErrors.push(error))
      }
    })
    throwViteAdapterErrors(results.flatMap(result => result.status === 'rejected' ? [result.reason] : []))
  })
  const replace = () => {
    const current = ++generation
    const retirement = retire(subscriptions.splice(0))
    const registration = Promise.resolve().then(async (): Promise<Readiness> => {
      await retirement
      while (active(current)) {
        const plans = await planPhysicalViteWatchTargets(targets, options, file => callbacks.accepts(file), () => active(current))
        if (!active(current)) {
          return 'closed'
        }
        const selected = await Promise.all(plans.map(plan => isPhysicalViteWatchPlanCurrent(plan)))
        if (!active(current)) {
          return 'closed'
        }
        if (!selected.every(Boolean)) {
          continue
        }
        for (const plan of plans) {
          const watcher = chokidar.watch(plan.root, plan.options)
          const readiness = createSidecarWatcherReadiness(watcher)
          let closingSubscription: Promise<void> | undefined
          const subscription: Subscription = {
            plan,
            watcher,
            ready: readiness.ready,
            close: () => {
              readiness.close()
              if (!closingSubscription) {
                try {
                  closingSubscription = Promise.resolve(watcher.close())
                }
                catch (error) {
                  closingSubscription = Promise.reject(error)
                }
              }
              return closingSubscription
            },
          }
          subscriptions.push(subscription)
          callbacks.options(watcher.options)
          watcher.on('all', (name, file, stats) => {
            if (active(current)) {
              if (name === 'unlinkDir' && absolute(file) === plan.root) {
                replace()
              }
              else {
                callbacks.event(name, file, stats)
              }
            }
          })
          watcher.on('raw', (...args) => {
            if (active(current)) {
              callbacks.raw(...args)
            }
          })
          watcher.on('error', (error) => {
            if (active(current)) {
              callbacks.pending(Promise.reject(error))
            }
          })
        }
        const registered = Promise.all(subscriptions.map(subscription => subscription.ready))
        void registered.catch(() => {})
        // 派发后先复核，避免已消失根上的 missing 回退永久阻挡首次 ready。
        const dispatched = await Promise.all(subscriptions.map(subscription => isPhysicalViteWatchPlanCurrent(subscription.plan)))
        if (!active(current)) {
          return 'closed'
        }
        if (!dispatched.every(Boolean)) {
          const results = await Promise.allSettled([retire(subscriptions.splice(0)), registered])
          throwViteAdapterErrors(results.flatMap(result => result.status === 'rejected' ? [result.reason] : []))
          continue
        }
        await registered
        if (!active(current)) {
          return 'closed'
        }
        const confirmed = await Promise.all(subscriptions.map(subscription => isPhysicalViteWatchPlanCurrent(subscription.plan)))
        if (!active(current)) {
          return 'closed'
        }
        if (confirmed.every(Boolean)) {
          return 'ready'
        }
        // 选择与注册之间发生了删除或目录替换；取消该代，不把 ready 当成有效登记。
        await retire(subscriptions.splice(0))
      }
      return 'closed'
    })
    registrations.add(registration)
    void registration.then(() => registrations.delete(registration), () => registrations.delete(registration))
    callbacks.pending(registration)
  }
  replace()
  return {
    watching: (file: string) => subscriptions.some(subscription => subscription.plan.reachable(file)),
    getWatched: () => subscriptions.map(subscription => subscription.watcher.getWatched()),
    closeFailures: () => [...failures.values()].map(failure => ({ ...failure, targets: [...failure.targets], lateErrors: [...failure.lateErrors] })),
    unwatch: (paths: string[]) => {
      for (const subscription of subscriptions) {
        subscription.watcher.unwatch(paths)
      }
    },
    close: () => {
      if (!closing) {
        closed = true
        generation++
        const retirement = retire(subscriptions.splice(0))
        closing = (async () => {
          const results = await Promise.allSettled([retirement])
          while (registrations.size) {
            await Promise.allSettled([...registrations])
          }
          // 失败 owner 仍持有底层句柄，但不再通过 matcher/回调保留旧宿主。
          callbacks.accepts = () => false
          callbacks.event = () => {}
          callbacks.raw = () => {}
          callbacks.options = () => {}
          callbacks.pending = () => {}
          throwViteAdapterErrors([...failures.values()].map(failure => failure.error)
            .concat(results.flatMap(result => result.status === 'rejected' ? [result.reason] : [])))
        })()
      }
      return closing
    },
  }
}
