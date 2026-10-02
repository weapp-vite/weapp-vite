import type { HeadlessTestingNodeEventInit } from './nodeHandle'
import { collectEventBindings, resolveEventBindingPhases } from './eventBindingParser'
import { collectNodeDataset } from './nodeDataset'

export interface MiniProgramEventBinding {
  method: string
  stopAfter: boolean
}

export function collectMiniProgramEventBindings(attributes: Record<string, string> = {}): Map<string, MiniProgramEventBinding> {
  return collectEventBindings(attributes, false).eventBindings
}

export function resolveMiniProgramEventBinding(
  attributes: Record<string, string> | undefined,
  eventName: string,
): MiniProgramEventBinding | null {
  return resolveEventBindingPhases(attributes, eventName, false)?.bubble ?? null
}

/** 冒泡时保留原始 target，currentTarget 则属于当前执行绑定的节点。 */
export function createMiniProgramEventPayload(
  node: { attribs?: Record<string, string>, dataset?: Record<string, unknown> },
  eventName: string,
  event: HeadlessTestingNodeEventInit,
  origin = node,
) {
  const dataset = collectNodeDataset(node)
  const nodeId = node.attribs?.id ?? ''
  const isOrigin = node === origin
  return {
    bubbles: false,
    capturePhase: false,
    composed: false,
    currentTarget: {
      dataset: isOrigin ? event.currentTarget?.dataset ?? event.dataset ?? dataset : dataset,
      id: isOrigin ? event.currentTarget?.id ?? event.id ?? nodeId : nodeId,
    },
    detail: event.detail,
    mark: event.mark,
    target: {
      dataset: event.target?.dataset ?? event.dataset ?? (isOrigin ? dataset : collectNodeDataset(origin)),
      id: event.target?.id ?? event.id ?? origin.attribs?.id ?? '',
    },
    timeStamp: Date.now(),
    type: eventName,
  }
}
