import type { HeadlessComponentInstance } from '../runtime/componentInstance'
import type { DomNodeLike, RuntimeRenderScope } from '../runtime/render/types'
import type { MiniProgramEventBinding } from './eventBinding'
import type { MiniProgramEventPhases } from './eventBindingParser'
import { collectEventBindings, resolveEventBindingPhases } from './eventBindingParser'
import { collectNodeDataset } from './nodeDataset'

interface ComponentEventNode {
  scope: RuntimeRenderScope
  target: Pick<DomNodeLike, 'attribs' | 'dataset'>
  hosts?: DomNodeLike[]
  bindings?: Pick<RuntimeRenderScope, 'eventBindings' | 'captureEventBindings'>
}

const eventNodes = new WeakMap<DomNodeLike, ComponentEventNode>()

/** 在构造子树之前建立父链，created/observer 中的事件也能访问声明树。 */
export function registerComponentEventNode(node: DomNodeLike, scope: RuntimeRenderScope, parent?: DomNodeLike) {
  node.parent = parent ?? null
  eventNodes.set(node, { scope, target: node })
}

/** 宿主与作用域共享同一份分阶段绑定，eventBindings 仍是原有的冒泡存储。 */
export function bindComponentEventHost(node: DomNodeLike) {
  const bindings = collectEventBindings(node.attribs)
  eventNodes.get(node)!.bindings = bindings
  return bindings
}

/** 渲染会把宿主折叠进模板根；事件仍保留两层独立的绑定和声明所有者。 */
export function mergeComponentEventRoot(root: DomNodeLike, host: DomNodeLike) {
  const entry = eventNodes.get(root)!
  if (entry.target === root) {
    entry.target = { attribs: root.attribs, dataset: root.dataset }
  }
  entry.hosts ??= []
  entry.hosts.push(host)
  root.parent = host.parent
}

export function buildComponentTrigger(
  componentScopeId: string,
  context: { componentScopes: Map<string, RuntimeRenderScope> },
) {
  return (
    instance: HeadlessComponentInstance,
    eventName: string,
    detail?: unknown,
    triggerOptions?: Record<string, any>,
  ) => {
    const originScope = context.componentScopes.get(componentScopeId)
    const origin = originScope?.hostNode
    if (!originScope || !origin) {
      return
    }
    const bubbles = triggerOptions?.bubbles ?? false
    const capturePhase = triggerOptions?.capturePhase ?? false
    const composed = triggerOptions?.composed ?? false
    const target = {
      dataset: originScope.dataset ?? collectNodeDataset(origin),
      id: originScope.hostId ?? '',
    }
    const mark = instance.__lastInteractionEvent__?.mark
    const listeners: Array<{
      scope: RuntimeRenderScope
      bindings: MiniProgramEventPhases
      currentTarget: typeof target
      origin: boolean
    }> = []
    const collect = (entry: ComponentEventNode, isOrigin: boolean) => {
      if (!composed && entry.scope.getScopeId() !== originScope.listenerScopeId) {
        return false
      }
      const bindings = entry.bindings
        ? { bubble: entry.bindings.eventBindings?.get(eventName), capture: entry.bindings.captureEventBindings?.get(eventName) }
        : resolveEventBindingPhases(entry.target.attribs, eventName)
      if (bindings?.bubble || bindings?.capture) {
        listeners.push({
          scope: entry.scope,
          bindings,
          currentTarget: isOrigin
            ? target
            : {
                dataset: collectNodeDataset(entry.target),
                id: entry.target.attribs?.id ?? '',
              },
          origin: isOrigin,
        })
      }
      return true
    }
    let current: DomNodeLike | null | undefined = origin
    while (current) {
      const entry = eventNodes.get(current)
      if (entry) {
        if (!collect(entry, current === origin)) {
          break
        }
        let crossedBoundary = false
        for (const host of entry.hosts ?? []) {
          if (!collect(eventNodes.get(host)!, false)) {
            crossedBoundary = true
            break
          }
        }
        if (crossedBoundary) {
          break
        }
      }
      if (!bubbles && !capturePhase) {
        break
      }
      current = current.parent
    }

    // 固定所有可达节点、数据集及实例所有者，回调中的重渲染/移除/导航不会改写本次路径。
    const handlers: Array<{ scope: RuntimeRenderScope, binding: MiniProgramEventBinding, currentTarget: typeof target }> = []
    let stopped = false
    if (capturePhase) {
      for (let index = listeners.length - 1; index >= 0; index--) {
        const listener = listeners[index]!
        const binding = listener.bindings.capture
        if (binding) {
          handlers.push({ scope: listener.scope, binding, currentTarget: listener.currentTarget })
          if (binding.stopAfter) {
            stopped = true
            break
          }
        }
      }
    }
    if (!stopped) {
      for (const listener of listeners) {
        if (!bubbles && !listener.origin) {
          continue
        }
        const binding = listener.bindings.bubble
        if (binding) {
          handlers.push({ scope: listener.scope, binding, currentTarget: listener.currentTarget })
          if (binding.stopAfter) {
            break
          }
        }
      }
    }
    for (const { scope, binding, currentTarget } of handlers) {
      scope.getMethod(binding.method)?.({
        bubbles,
        capturePhase,
        composed,
        currentTarget,
        detail,
        mark,
        target,
        type: eventName,
      })
    }
  }
}
