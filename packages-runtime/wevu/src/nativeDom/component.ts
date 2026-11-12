import type { ComponentInternalInstance, ComponentOptions, VNode } from '@vue/runtime-core'
import type { InternalRuntimeState } from '../runtime/types'
import {
  getCurrentInstance as getVueInstance,
  onBeforeUnmount,
  onBeforeUpdate,
  onMounted,
  onUnmounted,
  onUpdated,
  nextTick as vueNextTick,
} from '@vue/runtime-core'
import { WEVU_ON_BEFORE_UNMOUNT_HOOK, WEVU_PARENT_INSTANCE_KEY } from '@weapp-core/constants'
import { effect, effectScope, shallowReactive, watch } from '../reactivity'
import { callHookList, callUpdateHooks, getCurrentInstance, getCurrentSetupContext, setCurrentInstance, setCurrentSetupContext } from '../runtime/hooks'
import { attachInstanceProvides, getInstanceProvides } from '../runtime/provideContext'
import { queueJob } from '../scheduler'
import { createNativeEmit } from './events'

export interface NativePageContext {
  host: InternalRuntimeState
  query: Record<string, unknown>
  cleanups: Set<() => void>
}

export const nativePageContextKey = Symbol('wevu native page')

export type NativeRender = (...args: any[]) => VNode
export type WevuOptions = Record<string, any>
const targets = new WeakMap<ComponentInternalInstance, InternalRuntimeState>()

/** 把 Wevu 自有响应式依赖接到 Vue 的结构 diff，更新仍经过 Wevu 队列。 */
export function createNativeComponent(options: WevuOptions, render: NativeRender): ComponentOptions {
  const renders = new WeakMap<ComponentInternalInstance, (...args: any[]) => VNode>()
  return {
    ...options,
    setup(props, vueContext) {
      for (const key of ['data', 'computed', 'watch', 'methods', 'mixins', 'extends', 'behaviors']) {
        if (options[key] != null) {
          throw new Error(`[wevu] native-dom 暂不支持 ${key} 选项，请使用 setup 或 legacy`)
        }
      }
      const instance = getVueInstance()!
      const scope = effectScope()
      const page = instance.appContext.provides[nativePageContextKey] as NativePageContext | undefined
      const target = (instance.parent ? Object.create(null) : page?.host ?? {}) as InternalRuntimeState
      const parent = instance.parent ? targets.get(instance.parent) : undefined
      target[WEVU_PARENT_INSTANCE_KEY] = parent
      attachInstanceProvides(target, Object.create(parent ? getInstanceProvides(parent) : null))
      targets.set(instance, target)
      const cleanup = () => {
        scope.stop()
        targets.delete(instance)
        renders.delete(instance)
        page?.cleanups.delete(cleanup)
      }
      page?.cleanups.add(cleanup)
      // Vue props 更新时必须同步进入 Wevu 依赖图。
      const wevuProps = shallowReactive<Record<string, any>>({ ...props })
      const syncProps = () => {
        for (const key of Object.keys(wevuProps)) {
          if (!(key in props)) {
            delete wevuProps[key]
          }
        }
        Object.assign(wevuProps, props)
      }
      const context = {
        ...vueContext,
        props: wevuProps,
        emit: createNativeEmit(instance, vueContext.emit),
        instance: target,
        proxy: instance.proxy,
        watch,
      }
      const previousInstance = getCurrentInstance()
      const previousContext = getCurrentSetupContext()
      setCurrentInstance(target)
      setCurrentSetupContext(context)
      let result: any
      try {
        result = scope.run(() => options.setup?.(wevuProps, context)) ?? {}
        if (result && typeof result.then === 'function') {
          throw new Error('[wevu] native-dom 暂不支持异步 setup')
        }
      }
      catch (error) {
        cleanup()
        throw error
      }
      finally {
        setCurrentInstance(previousInstance)
        setCurrentSetupContext(previousContext)
      }
      if (!instance.parent) {
        callHookList(target, 'onLoad', [page?.query ?? {}])
        options.onLoad?.call(target, page?.query ?? {})
      }
      const invoke = (name: string) => callHookList(target, name)
      invoke('onAttached')
      onMounted(() => {
        invoke('onReady')
        options.onReady?.call(target)
      })
      onBeforeUpdate(() => callUpdateHooks(target, 'before'))
      onUpdated(() => callUpdateHooks(target, 'after'))
      onBeforeUnmount(() => invoke(WEVU_ON_BEFORE_UNMOUNT_HOOK))
      onUnmounted(() => {
        cleanup()
        invoke('onUnload')
        invoke('onDetached')
        options.onUnload?.call(target)
      })
      const update = () => {
        if (!instance.isUnmounted) {
          instance.update()
        }
        return vueNextTick()
      }
      let args: any[] = []
      const runner = scope.run(() => effect(() => {
        syncProps()
        return render.apply(instance.proxy, args)
      }, { lazy: true, scheduler: () => queueJob(update) }))!
      renders.set(instance, (...nextArgs: any[]) => {
        args = nextArgs
        return runner()
      })
      return result
    },
    render(...args: any[]) {
      return renders.get(getVueInstance()!)!(...args)
    },
  }
}

export function getNativeTarget(instance: ComponentInternalInstance | null) {
  return instance ? targets.get(instance) : undefined
}
