import type { PreviewTapTarget } from './constants'

export function resolveTapTarget(target: EventTarget | null): PreviewTapTarget | null {
  const originNode = target instanceof Node ? target : null
  const origin = originNode instanceof Element
    ? originNode
    : originNode?.parentElement
  const node = origin?.closest('[data-sim-node][data-sim-scope]')
  if (!node) {
    return null
  }
  return {
    nodeId: node.getAttribute('data-sim-node')!,
    scopeId: node.getAttribute('data-sim-scope')!,
  }
}
