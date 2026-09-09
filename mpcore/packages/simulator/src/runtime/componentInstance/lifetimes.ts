import type { HeadlessBehaviorDefinition, HeadlessComponentDefinition } from './types'
import { mergeRecord } from './shared'

export function mergeComponentLifetimes(behaviors: HeadlessBehaviorDefinition[], definition: HeadlessComponentDefinition) {
  const lifetimes = mergeRecord(...behaviors.map(item => item.lifetimes), definition.lifetimes)
  // Behavior 与组件的同名生命周期都执行；每个定义内优先使用 lifetimes 声明。
  for (const name of ['created', 'attached', 'ready', 'detached', 'moved', 'error']) {
    const handlers = [...behaviors, definition].map(item => item.lifetimes?.[name] ?? item[name]).filter((handler): handler is (...args: any[]) => void => typeof handler === 'function')
    if (handlers.length > 0) {
      lifetimes[name] = function (this: unknown, ...args: any[]) {
        for (const handler of handlers) {
          handler.apply(this, args)
        }
      }
    }
  }
  return lifetimes
}
