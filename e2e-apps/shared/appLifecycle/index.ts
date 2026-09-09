import type { AppHook } from './observer'
import { installHostLifecycleObserver } from './observer'

// 必须作为 app 入口的模块依赖执行；不能放入由 onLaunch 调用的 SFC setup 函数体。
const host = globalThis as unknown as Parameters<typeof installHostLifecycleObserver>[0]
if (host.App !== App || host.wx !== wx) {
  throw new Error('App lifecycle observer cannot access the native host bindings')
}
const observer = installHostLifecycleObserver(host)

export const readHostLifecycle = observer.read
export const recordHostLifecycleHook = (hook: string, args: unknown[]) => observer.record(hook as AppHook, args)

export function getHostLifecycleInputRows() {
  const evidence = observer.read()
  return (['onLaunch', 'onShow'] as const).map(hook => ({
    hook,
    host: evidence.host.find(entry => entry.hook === hook)?.summary ?? `${hook}: missing host input`,
    received: evidence.hooks.find(entry => entry.hook === hook)?.summary ?? `${hook}: missing hook input`,
  }))
}
