import type { InternalRuntimeState, MethodDefinitions } from '../../types'
import { parseModelEventValue } from '../../internal'
import { runInlineExpression } from '../inline'

export function createComponentMethods(options: {
  userMethods: Record<string, (...args: any[]) => any>
  runtimeMethods: MethodDefinitions
}) {
  const { userMethods, runtimeMethods } = options
  const finalMethods: Record<string, (...args: any[]) => any> = {
    ...userMethods,
  }

  if (!finalMethods.__weapp_vite_inline) {
    finalMethods.__weapp_vite_inline = function __weapp_vite_inline(this: InternalRuntimeState, event: any) {
      const expr = event?.currentTarget?.dataset?.wvHandler ?? event?.target?.dataset?.wvHandler
      const ctx = (this as any).__wevu?.proxy ?? this
      return runInlineExpression(ctx, expr, event)
    }
  }

  if (!finalMethods.__weapp_vite_model) {
    finalMethods.__weapp_vite_model = function __weapp_vite_model(this: InternalRuntimeState, event: any) {
      const path = event?.currentTarget?.dataset?.wvModel ?? event?.target?.dataset?.wvModel
      if (typeof path !== 'string' || !path) {
        return undefined
      }
      const runtime = (this as any).__wevu
      if (!runtime || typeof runtime.bindModel !== 'function') {
        return undefined
      }
      const value = parseModelEventValue(event)
      try {
        runtime.bindModel(path).update(value)
      }
      catch {
        // 忽略异常
      }
      return undefined
    }
  }

  if (!finalMethods.__weapp_vite_owner && typeof (runtimeMethods as any)?.__weapp_vite_owner === 'function') {
    finalMethods.__weapp_vite_owner = (runtimeMethods as any).__weapp_vite_owner
  }

  const methodNames = Object.keys(runtimeMethods ?? {})

  for (const methodName of methodNames) {
    if (methodName.startsWith('__weapp_vite_')) {
      continue
    }
    const userMethod = finalMethods[methodName]
    finalMethods[methodName] = function componentMethod(this: InternalRuntimeState, ...args: any[]) {
      const runtime = this.__wevu
      let result: unknown
      const bound = runtime?.methods?.[methodName]
      if (bound) {
        result = bound.apply(runtime.proxy, args)
      }
      if (typeof userMethod === 'function') {
        const userResult = userMethod.apply(this, args)
        return userResult === undefined ? result : userResult
      }
      return result
    }
  }

  return {
    finalMethods,
  }
}
