import type { InternalRuntimeState, RuntimeInstance } from '../../types'
import type { SetupInstanceMethodName } from './setupContext'
import { setupInstanceMethodNames } from './setupContext'

export function bridgeRuntimeMethodsToTarget(
  target: InternalRuntimeState,
  runtime: RuntimeInstance<any, any, any>,
) {
  try {
    const methods = (runtime.methods as unknown) as Record<string, any>
    for (const name of Object.keys(methods)) {
      if (setupInstanceMethodNames.includes(name as SetupInstanceMethodName)) {
        continue
      }
      if (typeof (target as any)[name] !== 'function') {
        ;(target as any)[name] = function bridged(this: any, ...args: any[]) {
          const bound = (this.$wevu?.methods as any)?.[name]
          if (typeof bound === 'function') {
            return bound.apply(this.$wevu.proxy, args)
          }
        }
      }
    }
  }
  catch {
    // 桥接过程中若发生错误（如目标被封装）则忽略，避免阻断后续流程
  }
}
