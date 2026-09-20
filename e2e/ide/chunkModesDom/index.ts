import type { RuntimeRouteCase } from '../../chunk-modes.matrix'
import type { DomCheckpoint } from '../../utils/domAcceptance/types'

export function chunkRouteCheckpoint(scenarioId: string, route: RuntimeRouteCase): DomCheckpoint {
  return {
    id: route.route,
    route: route.route,
    action: 'Navigate to the package page and render the selected chunk topology and imported values',
    nodes: [
      { selector: '#chunk-title', text: route.readyText },
      { selector: '#chunk-route', text: route.route.replace(/^\//, '') },
      { selector: '#chunk-scenario', text: scenarioId },
      { selector: '.chunk-token', count: route.expectedTokens.length },
      ...route.expectedTokens.map((text, index) => ({ selector: `#chunk-token-${index}`, text })),
      ...(route.route === '/pages/index/index' ? [{ selector: '#chunk-async', text: '__ASYNC_MARKER__' }] : []),
    ],
  }
}
