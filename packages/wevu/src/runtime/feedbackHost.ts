import { getCurrentInstance, getCurrentSetupContext, onAttached, onDetached } from './hooks'

type FeedbackHostContext = Record<string, any>

const pageFeedbackHosts = new WeakMap<object, Map<string, FeedbackHostContext>>()

function resolveCurrentPageInstance() {
  const getCurrentPagesFn = (globalThis as Record<string, unknown>).getCurrentPages
  if (typeof getCurrentPagesFn !== 'function') {
    return undefined
  }
  const pages = getCurrentPagesFn() as Array<Record<string, any>>
  return pages.at(-1)
}

function normalizeSelectors(selectors: string | string[]) {
  return Array.from(new Set(Array.isArray(selectors) ? selectors : [selectors]))
    .filter((selector): selector is string => typeof selector === 'string' && selector.length > 0)
}

function resolvePageFromContext(context?: FeedbackHostContext) {
  if (context && typeof context.__wevuSetPageLayout === 'function') {
    return context
  }
  return resolveCurrentPageInstance()
}

/**
 * 为当前页面注册可复用的反馈组件宿主。
 */
export function registerPageFeedbackHost(
  selectors: string | string[],
  context?: FeedbackHostContext,
) {
  const hostContext = context ?? getCurrentInstance<FeedbackHostContext>()
  const page = resolvePageFromContext(hostContext)
  if (!hostContext || !page) {
    return false
  }

  const registry = pageFeedbackHosts.get(page) ?? new Map<string, FeedbackHostContext>()
  for (const selector of normalizeSelectors(selectors)) {
    registry.set(selector, hostContext)
  }
  pageFeedbackHosts.set(page, registry)
  return true
}

/**
 * 移除当前页面的反馈组件宿主注册。
 */
export function unregisterPageFeedbackHost(
  selectors: string | string[],
  context?: FeedbackHostContext,
) {
  const hostContext = context ?? getCurrentInstance<FeedbackHostContext>()
  const page = resolvePageFromContext(hostContext)
  if (!hostContext || !page) {
    return false
  }

  const registry = pageFeedbackHosts.get(page)
  if (!registry) {
    return false
  }

  for (const selector of normalizeSelectors(selectors)) {
    if (registry.get(selector) === hostContext) {
      registry.delete(selector)
    }
  }

  if (registry.size === 0) {
    pageFeedbackHosts.delete(page)
  }

  return true
}

/**
 * 解析当前页面已注册的反馈组件宿主，找不到时回退到传入上下文。
 */
export function resolvePageFeedbackHost<T = any>(
  selector: string,
  fallbackContext?: T,
) {
  const page = resolvePageFromContext(fallbackContext as FeedbackHostContext | undefined)
  const hostContext = page ? pageFeedbackHosts.get(page)?.get(selector) : undefined
  return (hostContext ?? fallbackContext ?? getCurrentInstance()) as T | undefined
}

/**
 * 在组件生命周期内将当前实例注册为页面反馈宿主。
 */
export function usePageFeedbackHost(selectors: string | string[]) {
  if (!getCurrentSetupContext()) {
    throw new Error('usePageFeedbackHost() 必须在 setup() 的同步阶段调用')
  }

  const context = getCurrentInstance<FeedbackHostContext>()
  const normalizedSelectors = normalizeSelectors(selectors)

  onAttached(() => {
    registerPageFeedbackHost(normalizedSelectors, context)
  })

  onDetached(() => {
    unregisterPageFeedbackHost(normalizedSelectors, context)
  })
}
