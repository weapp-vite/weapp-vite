import type { HeadlessWx } from '../host/wx/api'
import type { HeadlessPageInstance } from '../runtime/pageInstance'
import type { HeadlessTestingNodeEventInit } from './nodeHandle'
import { createMiniProgramEventPayload, resolveMiniProgramEventBinding } from './eventBinding'
import { collectNodeDataset } from './nodeDataset'
import { resolveNativeScrollBounds } from './nodeGeometry'

export interface HeadlessNativeNode {
  attribs?: Record<string, string>
  children?: HeadlessNativeNode[]
  name?: string
  dataset?: Record<string, unknown>
  data?: string
  type?: string
  parent?: HeadlessNativeNode | null
}

interface ScrollViewState {
  boundTop: number
  boundLeft: number
  scrollTop: number
  scrollLeft: number
  maxTop: number
  maxLeft: number
}

const pageScrollViews = new WeakMap<HeadlessPageInstance, Map<string, ScrollViewState>>()

function coordinate(value: unknown) {
  const number = Number(value)
  return Number.isFinite(number) ? Math.max(0, number) : 0
}

function nodeKey(node: HeadlessNativeNode) {
  return node.attribs?.['data-sim-node'] ?? ''
}

/** 原生滚动位置独立于绑定值；未改变的绑定不能覆盖用户滚动。 */
export function syncNativeScrollViews(
  page: HeadlessPageInstance,
  root: HeadlessNativeNode,
  emit: (scopeId: string | null, method: string, event: Record<string, unknown>) => void,
) {
  let states = pageScrollViews.get(page)
  let present: Set<string> | undefined
  const visit = (node: HeadlessNativeNode) => {
    if (node.name === 'scroll-view') {
      const key = nodeKey(node)
      present ??= new Set()
      present.add(key)
      if (!states) {
        states = new Map()
        pageScrollViews.set(page, states)
      }
      const boundTop = coordinate(node.attribs?.['scroll-top'])
      const boundLeft = coordinate(node.attribs?.['scroll-left'])
      const bounds = resolveNativeScrollBounds(node)
      const scrollY = node.attribs?.['scroll-y']
      const scrollX = node.attribs?.['scroll-x']
      const maxTop = scrollY !== undefined && scrollY !== 'false' && scrollY !== '0' ? bounds.maxTop : 0
      const maxLeft = scrollX !== undefined && scrollX !== 'false' && scrollX !== '0' ? bounds.maxLeft : 0
      let state = states.get(key)
      const previousTop = state?.scrollTop ?? 0
      const previousLeft = state?.scrollLeft ?? 0
      if (!state) {
        state = { boundTop, boundLeft, scrollTop: boundTop, scrollLeft: boundLeft, maxTop, maxLeft }
        states.set(key, state)
      }
      else {
        if (state.boundTop !== boundTop) {
          state.scrollTop = boundTop
          state.boundTop = boundTop
        }
        if (state.boundLeft !== boundLeft) {
          state.scrollLeft = boundLeft
          state.boundLeft = boundLeft
        }
      }
      state.maxTop = maxTop
      state.maxLeft = maxLeft
      state.scrollTop = Math.min(state.scrollTop, maxTop)
      state.scrollLeft = Math.min(state.scrollLeft, maxLeft)
      if (state.scrollTop !== previousTop || state.scrollLeft !== previousLeft) {
        const binding = resolveMiniProgramEventBinding(node.attribs, 'scroll')
        if (binding?.method) {
          const target = { id: node.attribs?.id ?? '', dataset: collectNodeDataset(node) }
          emit(node.attribs?.['data-sim-scope'] ?? null, binding.method, {
            type: 'scroll',
            timeStamp: Date.now(),
            detail: { scrollTop: state.scrollTop, scrollLeft: state.scrollLeft },
            target,
            currentTarget: target,
          })
        }
      }
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  visit(root)
  if (states) {
    for (const key of states.keys()) {
      if (!present?.has(key)) {
        states.delete(key)
      }
    }
  }
}

export function getNativeScrollOffset(page: HeadlessPageInstance, node: HeadlessNativeNode) {
  const state = pageScrollViews.get(page)?.get(nodeKey(node))
  return {
    scrollTop: state?.scrollTop ?? 0,
    scrollLeft: state?.scrollLeft ?? 0,
  }
}

/** 原生交互更新宿主状态，导航仍交给统一 wx 路由入口。 */
export function dispatchNativeNodeEvent(
  page: HeadlessPageInstance,
  node: HeadlessNativeNode,
  eventName: string,
  event: HeadlessTestingNodeEventInit,
  wx: HeadlessWx,
  resolveMethod: (scopeId: string | null, method: string) => (event: Record<string, unknown>) => unknown,
  onHandlerResult?: (result: unknown) => void,
) {
  if (eventName === 'scroll' && node.name === 'scroll-view') {
    const detail = event.detail as { scrollTop?: unknown, scrollLeft?: unknown } | undefined
    const state = pageScrollViews.get(page)?.get(nodeKey(node))
    if (state) {
      if (detail?.scrollTop !== undefined) {
        state.scrollTop = Math.min(coordinate(detail.scrollTop), state.maxTop)
      }
      if (detail?.scrollLeft !== undefined) {
        state.scrollLeft = Math.min(coordinate(detail.scrollLeft), state.maxLeft)
      }
    }
    event.detail = Object.assign(
      event.detail && typeof event.detail === 'object' ? event.detail : {},
      getNativeScrollOffset(page, node),
    )
    return true
  }
  if (eventName !== 'tap') {
    return false
  }
  let current: HeadlessNativeNode | null | undefined = node
  let navigator: HeadlessNativeNode | undefined
  let handlers: Array<{ node: HeadlessNativeNode, call: (event: Record<string, unknown>) => unknown }> | undefined
  let handled = false
  while (current) {
    if (!navigator && current.name === 'navigator') {
      navigator = current
    }
    const binding = resolveMiniProgramEventBinding(current.attribs, 'tap')
    if (binding?.method) {
      const call = resolveMethod(current.attribs?.['data-sim-scope'] ?? null, binding.method)
      handlers ??= []
      handlers.push({ node: current, call })
      handled = true
    }
    if (binding?.stopAfter) {
      handled = true
      break
    }
    current = current.parent
  }
  // 先固定可达路径及其所有者，再执行可能移除组件或同步导航的回调。
  if (handlers) {
    for (const handler of handlers) {
      const result = handler.call(createMiniProgramEventPayload(handler.node, 'tap', event, node))
      onHandlerResult?.(result)
    }
  }
  if (!navigator) {
    return handled
  }
  const openType = navigator.attribs?.['open-type'] ?? 'navigate'
  const url = navigator.attribs?.url ?? ''
  switch (openType) {
    case 'navigate':
      wx.navigateTo({ url })
      break
    case 'redirect':
      wx.redirectTo({ url })
      break
    case 'switchTab':
      wx.switchTab({ url })
      break
    case 'reLaunch':
      wx.reLaunch({ url })
      break
    case 'navigateBack':
      wx.navigateBack({ delta: Number(navigator.attribs?.delta ?? 1) })
      break
    default:
      return handled
  }
  return true
}
