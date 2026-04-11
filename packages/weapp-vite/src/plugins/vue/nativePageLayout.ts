import type { WevuPageLayoutMap } from 'wevu'
import { WEVU_PAGE_LAYOUT_SETTER_KEY } from '@weapp-core/constants'

type PageLayoutSetter = (layout: string | false, props?: Record<string, any>) => void

type ResolveTypedPageLayoutName = keyof WevuPageLayoutMap extends never
  ? string
  : Extract<keyof WevuPageLayoutMap, string>

type ResolveTypedPageLayoutProps<Name extends string> = Name extends keyof WevuPageLayoutMap
  ? WevuPageLayoutMap[Name]
  : Record<string, any>

function resolveCurrentPageInstance() {
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }

  const pages = getCurrentPagesFn() as Array<Record<string, any>>
  return pages.at(-1)
}

export function setPageLayout(layout: false): void
export function setPageLayout<Name extends ResolveTypedPageLayoutName>(layout: Name, props?: ResolveTypedPageLayoutProps<Name>): void

/**
 * 为原生 Page() 页面切换 layout。
 */
export function setPageLayout(layout: string | false, props?: Record<string, any>): void {
  const currentPage = resolveCurrentPageInstance()
  const pageSetter = currentPage?.[WEVU_PAGE_LAYOUT_SETTER_KEY] as PageLayoutSetter | undefined

  if (typeof pageSetter === 'function') {
    pageSetter(layout, props)
    return
  }

  throw new Error('setPageLayout() 未找到当前页面实例。请在页面生命周期、事件回调或当前页面上下文中调用。')
}
