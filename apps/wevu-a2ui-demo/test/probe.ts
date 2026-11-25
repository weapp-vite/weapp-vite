import type { A2uiNode, A2uiSurfaceView } from '@wevu/a2ui'
import { createA2uiSession } from '@wevu/a2ui'
import { demoCatalog } from '../src/catalog'
import { createInitialMessages, SURFACE_ID } from '../src/fixtures/afterSales'

function find(node: A2uiNode | undefined, componentId: string): A2uiNode | undefined {
  if (!node) {
    return undefined
  }
  if (node.componentId === componentId) {
    return node
  }
  for (const child of node.children) {
    const found = find(child, componentId)
    if (found) {
      return found
    }
  }
  return undefined
}

export function probe() {
  let views: A2uiSurfaceView[] = []
  const session = createA2uiSession({
    catalog: demoCatalog,
    onSurfaces: (next) => {
      views = next
    },
    onAction: () => {},
  })
  for (const message of createInitialMessages()) {
    session.receive(message)
  }
  session.receive({
    version: '1.0',
    updateDataModel: { surfaceId: SURFACE_ID, path: '/form/reason', value: '兼容检查' },
  })
  const reason = find(views.find(view => view.id === SURFACE_ID)?.root, 'reason')?.props.value
  session.dispose()
  return reason
}
