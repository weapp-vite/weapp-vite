import type { A2uiActionMessage, A2uiErrorMessage, A2uiFunctionHandler, A2uiNode, A2uiSessionOptions, A2uiSurfaceView } from './types'
import { createA2uiSession } from './session'
import { TEST_CATALOG_ID, testCatalog } from './testFixture'

export interface SessionSetupResult {
  session: ReturnType<typeof createA2uiSession>
  batches: A2uiSurfaceView[][]
  actions: A2uiActionMessage[]
  errors: A2uiErrorMessage[]
  latest: () => A2uiSurfaceView[]
}

export function setupSession(
  functionImplementations?: Readonly<Record<string, A2uiFunctionHandler>>,
  catalog: Record<string, any> = testCatalog,
  listeners: Partial<Pick<A2uiSessionOptions, 'onAction' | 'onError'>> = {},
): SessionSetupResult {
  const batches: A2uiSurfaceView[][] = []
  const actions: A2uiActionMessage[] = []
  const errors: A2uiErrorMessage[] = []
  const session = createA2uiSession({
    catalog,
    onSurfaces: views => batches.push(views),
    onAction: (message) => {
      actions.push(message)
      return listeners.onAction?.(message)
    },
    onError: (error) => {
      errors.push(error)
      return listeners.onError?.(error)
    },
    functionImplementations,
  })
  return { session, batches, actions, errors, latest: () => batches.at(-1) ?? [] }
}

export function findNode(node: A2uiNode | undefined, componentId: string): A2uiNode | undefined {
  if (!node) {
    return undefined
  }
  if (node.componentId === componentId) {
    return node
  }
  for (const child of node.children) {
    const found = findNode(child, componentId)
    if (found) {
      return found
    }
  }
  return undefined
}

export function surfaceMessage(type: string, payload: Record<string, unknown>) {
  return { version: '1.0', [type]: payload }
}

export function createSurfaceMessage(surfaceId: string, components: unknown[], dataModel?: Record<string, unknown>) {
  return surfaceMessage('createSurface', {
    surfaceId,
    catalogId: TEST_CATALOG_ID,
    components,
    ...(dataModel ? { dataModel } : {}),
  })
}

export function rootOf(result: SessionSetupResult, surfaceId = 's1') {
  return result.latest().find(view => view.id === surfaceId)?.root
}
