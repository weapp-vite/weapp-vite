import type { RuntimeScheduler } from '../../kernel/scheduler'
import type { HeadlessPageInstance } from '../../runtime/pageInstance'
import type { HeadlessNativeNode } from '../nativeNode'
import type { HeadlessTestingNodeEventInit } from '../nodeEvents'
import { createMiniProgramEventPayload, resolveMiniProgramEventBinding } from '../eventBinding'
import { getNativeBindingCommit } from '../nativeBindings'
import { NativeRefresherState } from './state'

interface RefresherEntry {
  state: NativeRefresherState
  node: HeadlessNativeNode
  triggered?: string
  consumed?: { owner: object, revision: number }
}

interface RefresherHost {
  scheduler: RuntimeScheduler
  emit: (scopeId: string | null, method: string, event: Record<string, unknown>) => void
}

const pages = new WeakMap<HeadlessPageInstance, Map<string, RefresherEntry>>()
const touchNames = new Set(['touchstart', 'touchmove', 'touchend', 'touchcancel'])
const gestureOwners = new Set(['swiper', 'movable-view', 'picker-view', 'canvas'])

function enabled(node: HeadlessNativeNode, name: string) {
  const value = node.attribs?.[name]
  return value !== undefined && value !== 'false' && value !== '0'
}

function key(node: HeadlessNativeNode) {
  return node.attribs?.['data-sim-node'] ?? ''
}

/** 两种 provider 在完整树同步后交付一次原生受控命令，查询重渲染不会重放。 */
export function syncNativeRefreshers(page: HeadlessPageInstance, root: HeadlessNativeNode, host: RefresherHost) {
  let entries = pages.get(page)
  if (!entries) {
    entries = new Map()
    pages.set(page, entries)
  }
  const present = new Set<string>()
  const visit = (node: HeadlessNativeNode) => {
    if (node.name === 'scroll-view') {
      const id = key(node)
      present.add(id)
      let entry = entries!.get(id)
      const initial = !entry
      if (!entry) {
        entry = {
          node,
          state: new NativeRefresherState(host.scheduler, (name, detail) => {
            const current = entries!.get(id)
            if (!current) {
              return
            }
            const binding = resolveMiniProgramEventBinding(current.node.attribs, name)
            if (binding?.method) {
              host.emit(current.node.attribs?.['data-sim-scope'] ?? null, binding.method, createMiniProgramEventPayload(current.node, name, { detail }))
            }
          }),
        }
        entries!.set(id, entry)
      }
      entry.node = node
      entry.state.configure(enabled(node, 'scroll-y') && enabled(node, 'refresher-enabled'), node.attribs?.['refresher-threshold'])
      const commit = getNativeBindingCommit(node, entry.consumed)
      entry.consumed = commit.consumed
      const triggered = node.attribs?.['refresher-triggered']
      const changed = initial || entry.triggered !== triggered
      entry.triggered = triggered
      if (changed || commit.explicit) {
        entry.state.commit(enabled(node, 'refresher-triggered'))
      }
    }
    for (const child of node.children ?? []) {
      visit(child)
    }
  }
  visit(root)
  for (const [id, entry] of entries) {
    if (!present.has(id)) {
      entry.state.cancel()
      entries.delete(id)
    }
  }
}

export function dispatchNativeRefresherEvent(
  page: HeadlessPageInstance,
  node: HeadlessNativeNode,
  name: string,
  event: HeadlessTestingNodeEventInit,
  getScrollTop: (node: HeadlessNativeNode) => number,
) {
  if (!touchNames.has(name)) {
    return false
  }
  let current: HeadlessNativeNode | null | undefined = node
  while (current) {
    if (gestureOwners.has(current.name ?? '')) {
      return false
    }
    if (current.name === 'scroll-view') {
      const entry = pages.get(page)?.get(key(current))
      entry?.state.dispatch(name, event, getScrollTop(current))
      return !!entry
    }
    current = current.parent
  }
  return false
}

export function releaseNativeRefreshers(page: HeadlessPageInstance) {
  for (const entry of pages.get(page)?.values() ?? []) {
    entry.state.cancel()
  }
  pages.delete(page)
}
