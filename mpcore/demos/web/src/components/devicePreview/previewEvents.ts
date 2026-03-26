import type { PreviewTapInvocation } from './constants'

function collectDataset(node: HTMLElement) {
  const dataset: Record<string, string> = {}
  for (const [key, value] of Object.entries(node.dataset)) {
    dataset[key] = String(value)
  }
  return dataset
}

export function resolveTapChain(target: EventTarget | null) {
  const originNode = target instanceof Node ? target : null
  const origin = originNode instanceof HTMLElement
    ? originNode
    : originNode?.parentElement ?? null
  let current = origin
  let nearestScopeId = ''
  const chain: PreviewTapInvocation[] = []

  while (current) {
    const scopeId = current.getAttribute('data-sim-scope') ?? ''
    const catchTap = current.getAttribute('catchtap') || current.getAttribute('catch:tap')
    const bindTap = current.getAttribute('bindtap') || current.getAttribute('bind:tap')

    if (!nearestScopeId && scopeId) {
      nearestScopeId = scopeId
    }

    const method = catchTap || bindTap
    if (method && scopeId) {
      chain.push({
        event: {
          currentTarget: {
            dataset: collectDataset(current),
            id: current.id ?? '',
          },
          target: {
            dataset: origin ? collectDataset(origin) : {},
            id: origin?.id ?? '',
          },
        },
        method,
        scopeId,
        stopAfter: Boolean(catchTap),
      })
      if (catchTap) {
        break
      }
    }
    current = current.parentElement
  }

  if (!nearestScopeId) {
    return null
  }

  return {
    activeScopeId: nearestScopeId,
    chain,
  }
}
