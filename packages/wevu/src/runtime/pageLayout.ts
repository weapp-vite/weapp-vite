import { getCurrentInstance } from './hooks'

const PAGE_LAYOUT_SETTER_KEY = '__wevuSetPageLayout'
const NO_LAYOUT_RUNTIME_KEY = '__wv_no_layout'

type PageLayoutSetter = (layout: string | false, props?: Record<string, any>) => void

function resolveCurrentPageInstance() {
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }
  const pages = getCurrentPagesFn() as Array<Record<string, any>>
  return pages.at(-1)
}

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
