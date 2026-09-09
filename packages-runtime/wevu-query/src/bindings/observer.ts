import type { ShallowRef, WatchStopHandle } from 'wevu'
import type {
  QueryObserverOptions,
  QueryState,
  RefetchOnShow,
  Unsubscribe,
} from '../core/types'
import {
  batch,
  onHide,
  onMounted,
  onScopeDispose,
  onShow,
  onUnload,
  shallowRef,
  watch,
} from 'wevu'

interface ObserverLike<TData, TOptions> {
  getState: () => QueryState<TData>
  subscribe: (listener: (state: QueryState<TData>) => void) => Unsubscribe
  setOptions: (options: TOptions, observerOptions?: QueryObserverOptions) => void
  setActive: (active: boolean) => void
  destroy: () => void
}

export interface ResolvedBindingOptions<TOptions> {
  readonly options: TOptions
  readonly enabled: boolean
  readonly refetchOnShow: RefetchOnShow
}

export interface QueryBindingState<TData> {
  readonly state: ShallowRef<QueryState<TData>>
  readonly data: ShallowRef<TData | undefined>
  readonly hasData: ShallowRef<boolean>
}

/** 将查询观察者绑定到当前 Wevu 页面生命周期。 */
export function bindQueryObserver<TData, TOptions>(
  observer: ObserverLike<TData, TOptions>,
  resolveOptions: () => ResolvedBindingOptions<TOptions>,
): QueryBindingState<TData> {
  const initialState = observer.getState()
  const state = shallowRef(initialState)
  const data = shallowRef(initialState.data)
  const hasData = shallowRef(initialState.hasData)
  let active = false
  let destroyed = false

  const unsubscribe = observer.subscribe((nextState) => {
    if (!destroyed) {
      batch(() => {
        state.value = nextState
        data.value = nextState.data
        hasData.value = nextState.hasData
      })
    }
  })

  const stopOptionsWatch: WatchStopHandle = watch(resolveOptions, (resolved) => {
    if (destroyed) {
      return
    }
    observer.setOptions(resolved.options, {
      active,
      enabled: resolved.enabled,
      refetchOnShow: resolved.refetchOnShow,
    })
  }, { flush: 'sync' })

  const setActive = (nextActive: boolean) => {
    if (destroyed || active === nextActive) {
      return
    }
    active = nextActive
    observer.setActive(active)
  }

  const destroy = () => {
    if (destroyed) {
      return
    }
    destroyed = true
    stopOptionsWatch()
    unsubscribe()
    observer.destroy()
  }

  onMounted(() => setActive(true))
  onShow(() => setActive(true))
  onHide(() => setActive(false))
  onUnload(destroy)
  onScopeDispose(destroy)

  return { state, data, hasData }
}
