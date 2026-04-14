import {
  WEVU_PAGE_LAYOUT_NAME_KEY,
  WEVU_PAGE_LAYOUT_NONE,
  WEVU_PAGE_LAYOUT_PROPS_KEY,
  WEVU_PAGE_LAYOUT_SETTER_KEY,
} from '@weapp-core/constants'
import { reactive, readonly } from '../reactivity'
import { getCurrentInstance, getCurrentSetupContext } from './hooks'
import { getCurrentPageInstance } from './register/component/lifecycle/platform'

type PageLayoutSetter = (layout: string | false, props?: Record<string, any>) => void

export interface WevuPageLayoutMap {}

type ResolveTypedPageLayoutName = keyof WevuPageLayoutMap extends never
  ? string
  : Extract<keyof WevuPageLayoutMap, string>

type ResolveTypedPageLayoutProps<Name extends string> = Name extends keyof WevuPageLayoutMap
  ? WevuPageLayoutMap[Name]
  : Record<string, any>

type PageLayoutNamedState = {
  [Name in ResolveTypedPageLayoutName]: {
    name: Name
    props: ResolveTypedPageLayoutProps<Name>
  }
}[ResolveTypedPageLayoutName]

export type PageLayoutState
  = | PageLayoutNamedState
    | {
      name: false
      props: Record<string, any>
    }
    | {
      name: undefined
      props: Record<string, any>
    }

interface MutablePageLayoutState {
  name: string | false | undefined
  props: Record<string, any>
}

function resolveCurrentPageInstance() {
  const runtimeCurrentPage = getCurrentPageInstance()
  if (runtimeCurrentPage) {
    return runtimeCurrentPage
  }

  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }
  const pages = getCurrentPagesFn() as Array<Record<string, any>>
  return pages.at(-1)
}

function normalizeRuntimePageLayoutName(layout: string | undefined) {
  return layout === WEVU_PAGE_LAYOUT_NONE ? false : layout
}

/**
 * 获取当前页面 layout 状态。
 */
export function usePageLayout(): Readonly<PageLayoutState> {
  if (!getCurrentSetupContext()) {
    throw new Error('usePageLayout() 必须在 setup() 的同步阶段调用')
  }

  const currentInstance = getCurrentInstance() as Record<string, any> | undefined
  const runtimeState = currentInstance?.__wevu?.state as Record<string, any> | undefined
  const pageLayoutState = reactive<MutablePageLayoutState>({
    name: normalizeRuntimePageLayoutName(runtimeState?.[WEVU_PAGE_LAYOUT_NAME_KEY]) as string | false | undefined,
    props: { ...(runtimeState?.[WEVU_PAGE_LAYOUT_PROPS_KEY] ?? {}) },
  })

  if (currentInstance) {
    currentInstance.__wevuPageLayoutState = pageLayoutState
  }

  return readonly(pageLayoutState) as Readonly<PageLayoutState>
}

export function syncRuntimePageLayoutState(target: Record<string, any>, layout: string | false, props: Record<string, any>) {
  const state = target.__wevuPageLayoutState as MutablePageLayoutState | undefined
  if (!state) {
    return
  }
  state.name = layout
  state.props = { ...props }
}

export function syncRuntimePageLayoutStateFromRuntime(target: Record<string, any>) {
  const state = target.__wevuPageLayoutState as MutablePageLayoutState | undefined
  const runtimeState = target.__wevu?.state as Record<string, any> | undefined
  if (!state || !runtimeState) {
    return
  }
  state.name = normalizeRuntimePageLayoutName(runtimeState[WEVU_PAGE_LAYOUT_NAME_KEY]) as string | false | undefined
  state.props = { ...(runtimeState[WEVU_PAGE_LAYOUT_PROPS_KEY] ?? {}) }
}

export function setPageLayout(layout: false): void
export function setPageLayout<Name extends ResolveTypedPageLayoutName>(layout: Name, props?: ResolveTypedPageLayoutProps<Name>): void

/**
 * 显式切换当前页面使用的 layout。
 */
export function setPageLayout(layout: string | false, props?: Record<string, any>): void {
  const currentInstance = getCurrentInstance() as Record<string, any> | undefined
  const directSetter = currentInstance?.[WEVU_PAGE_LAYOUT_SETTER_KEY] as PageLayoutSetter | undefined
  if (typeof directSetter === 'function') {
    directSetter(layout, props)
    return
  }

  const currentPage = resolveCurrentPageInstance()
  const pageSetter = currentPage?.[WEVU_PAGE_LAYOUT_SETTER_KEY] as PageLayoutSetter | undefined
  if (typeof pageSetter === 'function') {
    pageSetter(layout, props)
    return
  }

  throw new Error('setPageLayout() 未找到当前页面实例。请在页面 setup()、事件回调或当前页面上下文中调用。')
}

export function resolveRuntimePageLayoutName(layout: string | false) {
  return layout === false ? WEVU_PAGE_LAYOUT_NONE : layout
}
