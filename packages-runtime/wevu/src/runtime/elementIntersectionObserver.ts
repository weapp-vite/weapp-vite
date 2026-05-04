import type { MaybeRefOrGetter } from '../reactivity'
import type {
  InternalRuntimeState,
  MiniProgramIntersectionObserver,
  MiniProgramIntersectionObserverOptions,
} from './types'
import { toValue, watch } from '../reactivity'
import { getCurrentInstance, getCurrentSetupContext, onDetached, onMounted, onUnload, onUnmounted } from './hooks'
import { getCurrentMiniProgramRuntimeCapabilities, getMiniProgramGlobalObject, supportsCurrentMiniProgramRuntimeCapability } from './platform'

export type ElementIntersectionObserverCallback<T = unknown> = (result: T) => void

export interface UseElementIntersectionObserverOptions<T = unknown> {
  context?: InternalRuntimeState | null
  enabled?: MaybeRefOrGetter<boolean>
  observerOptions?: MaybeRefOrGetter<MiniProgramIntersectionObserverOptions>
  onObserve?: ElementIntersectionObserverCallback<T>
  relativeToViewport?: boolean | Record<string, number>
  selector: MaybeRefOrGetter<string | null | undefined>
}

export interface UseElementIntersectionObserverReturn {
  disconnect: () => void
  observe: () => MiniProgramIntersectionObserver | null
  readonly observer: MiniProgramIntersectionObserver | null
}

function createObserverFromContext(
  context: InternalRuntimeState,
  options: MiniProgramIntersectionObserverOptions,
) {
  const nativeContext = context as Record<string, any>
  const creator = nativeContext.createIntersectionObserver
  if (typeof creator === 'function') {
    return creator.call(nativeContext, options) as MiniProgramIntersectionObserver | undefined
  }

  if (!supportsCurrentMiniProgramRuntimeCapability('globalCreateIntersectionObserver')) {
    return undefined
  }

  const miniProgramGlobal = getMiniProgramGlobalObject()
  const globalCreator = miniProgramGlobal?.createIntersectionObserver
  if (typeof globalCreator !== 'function') {
    return undefined
  }

  return getCurrentMiniProgramRuntimeCapabilities().intersectionObserverScopeByParameter
    ? globalCreator.call(miniProgramGlobal, context, options)
    : globalCreator.call(miniProgramGlobal, options)
}

function applyRelativeToViewport(
  observer: MiniProgramIntersectionObserver,
  relativeToViewport: UseElementIntersectionObserverOptions['relativeToViewport'],
) {
  if (relativeToViewport === false || typeof observer.relativeToViewport !== 'function') {
    return observer
  }
  const margins = relativeToViewport && typeof relativeToViewport === 'object'
    ? relativeToViewport
    : undefined
  return observer.relativeToViewport(margins as any) ?? observer
}

/**
 * 观察当前组件或页面内的节点可见性，并在卸载时自动断开。
 */
export function useElementIntersectionObserver<T = unknown>(
  options: UseElementIntersectionObserverOptions<T>,
): UseElementIntersectionObserverReturn {
  const context = options.context ?? getCurrentInstance<InternalRuntimeState>()
  if (!context || !getCurrentSetupContext()) {
    throw new Error('useElementIntersectionObserver() 必须在 setup() 的同步阶段调用')
  }

  let observer: MiniProgramIntersectionObserver | null = null

  const disconnect = () => {
    if (!observer) {
      return
    }
    try {
      observer.disconnect()
    }
    catch {
      // 忽略平台差异导致的断开异常，避免影响页面卸载流程
    }
    observer = null
  }

  const observe = () => {
    disconnect()

    const selector = toValue(options.selector)
    const enabled = options.enabled == null ? true : toValue(options.enabled)
    if (!enabled || !selector) {
      return null
    }

    const nextObserver = createObserverFromContext(
      context,
      toValue(options.observerOptions ?? {}),
    )
    if (!nextObserver || typeof nextObserver.observe !== 'function') {
      return null
    }

    observer = applyRelativeToViewport(
      nextObserver,
      options.relativeToViewport ?? true,
    )
    observer.observe(selector, result => options.onObserve?.(result as T))
    return observer
  }

  watch(
    () => [
      toValue(options.selector),
      options.enabled == null ? true : toValue(options.enabled),
      toValue(options.observerOptions ?? {}),
      options.relativeToViewport,
    ],
    () => {
      observe()
    },
    {
      deep: true,
    },
  )

  onMounted(observe)
  onUnmounted(disconnect)
  onUnload(disconnect)
  onDetached(disconnect)

  return {
    disconnect,
    observe,
    get observer() {
      return observer
    },
  }
}
