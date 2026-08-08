import type { WevuPageLayoutMap } from 'wevu'
import { WEVU_PAGE_LAYOUT_SETTER_KEY } from '@weapp-core/constants'
import { getCurrentPageInstance } from './polyfill/routeRuntime'

type PageLayoutSetter = (layout: string | false, props?: Record<string, any>) => void
type ResolveTypedPageLayoutName = keyof WevuPageLayoutMap extends never ? string : Extract<keyof WevuPageLayoutMap, string>
type ResolveTypedPageLayoutProps<Name extends string> = Name extends keyof WevuPageLayoutMap ? WevuPageLayoutMap[Name] : Record<string, any>

export function setPageLayout(layout: false): void
export function setPageLayout<Name extends ResolveTypedPageLayoutName>(layout: Name, props?: ResolveTypedPageLayoutProps<Name>): void

export function setPageLayout(layout: string | false, props?: Record<string, any>): void {
  const page = getCurrentPageInstance() as Record<string, any> | undefined
  const setter = page?.[WEVU_PAGE_LAYOUT_SETTER_KEY] as PageLayoutSetter | undefined
  if (typeof setter === 'function') {
    setter(layout, props)
    return
  }
  throw new Error('setPageLayout() 未找到当前 Web 页面实例。请在页面生命周期、事件回调或当前页面上下文中调用。')
}
