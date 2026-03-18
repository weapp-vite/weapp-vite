import { reactive, readonly } from '../reactivity'
import { getCurrentInstance, getCurrentSetupContext } from './hooks'

const PAGE_LAYOUT_SETTER_KEY = '__wevuSetPageLayout'
const NO_LAYOUT_RUNTIME_KEY = '__wv_no_layout'

type PageLayoutSetter = (layout: string | false, props?: Record<string, any>) => void

export interface WevuPageLayoutMap {}

type ResolveTypedPageLayoutName = keyof WevuPageLayoutMap extends never
  ? string
  : Extract<keyof WevuPageLayoutMap, string>

type ResolveTypedPageLayoutProps<Name extends string> = Name extends keyof WevuPageLayoutMap
  ? WevuPageLayoutMap[Name]
  : Record<string, any>

export interface PageLayoutState<Name extends string = ResolveTypedPageLayoutName> {
  name?: Name | false
  props: Record<string, any>
}

function resolveCurrentPageInstance() {
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }
  const pages = getCurrentPagesFn() as Array<Record<string, any>>
  return pages.at(-1)
}

function normalizeRuntimePageLayoutName(layout: string | undefined) {
  return layout === NO_LAYOUT_RUNTIME_KEY ? false : layout
}

/**
 * 获取当前页面 layout 状态。
 */
export function usePageLayout<Name extends string = ResolveTypedPageLayoutName>(): Readonly<PageLayoutState<Name>> {
  if (!getCurrentSetupContext()) {
    throw new Error('usePageLayout() 必须在 setup() 的同步阶段调用')
  }

  const currentInstance = getCurrentInstance() as Record<string, any> | undefined
  const runtimeState = currentInstance?.__wevu?.state as Record<string, any> | undefined
  const pageLayoutState = reactive<PageLayoutState<Name>>({
    name: normalizeRuntimePageLayoutName(runtimeState?.__wv_page_layout_name) as Name | false | undefined,
    props: { ...(runtimeState?.__wv_page_layout_props ?? {}) },
  })

  if (currentInstance) {
    currentInstance.__wevuPageLayoutState = pageLayoutState
  }

  return readonly(pageLayoutState) as Readonly<PageLayoutState<Name>>
}

export function syncRuntimePageLayoutState(target: Record<string, any>, layout: string | false, props: Record<string, any>) {
  const state = target.__wevuPageLayoutState as PageLayoutState | undefined
  if (!state) {
    return
  }
  state.name = layout
  state.props = { ...props }
}

export function syncRuntimePageLayoutStateFromRuntime(target: Record<string, any>) {
  const state = target.__wevuPageLayoutState as PageLayoutState | undefined
  const runtimeState = target.__wevu?.state as Record<string, any> | undefined
  if (!state || !runtimeState) {
    return
  }
  state.name = normalizeRuntimePageLayoutName(runtimeState.__wv_page_layout_name) as string | false | undefined
  state.props = { ...(runtimeState.__wv_page_layout_props ?? {}) }
}

export function setPageLayout(layout: false): void
export function setPageLayout<Name extends ResolveTypedPageLayoutName>(layout: Name, props?: ResolveTypedPageLayoutProps<Name>): void

/**
 * 显式切换当前页面使用的 layout。
 */
export function setPageLayout(layout: string | false, props?: Record<string, any>): void {
  const currentInstance = getCurrentInstance() as Record<string, any> | undefined
  const directSetter = currentInstance?.[PAGE_LAYOUT_SETTER_KEY] as PageLayoutSetter | undefined
  if (typeof directSetter === 'function') {
    directSetter(layout, props)
    return
  }

  const currentPage = resolveCurrentPageInstance()
  const pageSetter = currentPage?.[PAGE_LAYOUT_SETTER_KEY] as PageLayoutSetter | undefined
  if (typeof pageSetter === 'function') {
    pageSetter(layout, props)
    return
  }

  throw new Error('setPageLayout() 未找到当前页面实例。请在页面 setup()、事件回调或当前页面上下文中调用。')
}

export function resolveRuntimePageLayoutName(layout: string | false) {
  return layout === false ? NO_LAYOUT_RUNTIME_KEY : layout
}
