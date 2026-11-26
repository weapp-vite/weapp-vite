import type { A2uiNode, A2uiPropValue, A2uiSurfaceView } from '@wevu/a2ui'
import { createA2uiSession } from '@wevu/a2ui'
import { demoCatalog } from '../src/catalog'
import { BASIC_SURFACE_ID, basicMessages, createInitialMessages, SURFACE_ID } from '../src/fixtures/afterSales'

function find(value: A2uiPropValue | undefined, componentId: string): A2uiNode | undefined {
  if (Array.isArray(value)) {
    for (const item of value) {
      const found = find(item, componentId)
      if (found) {
        return found
      }
    }
    return undefined
  }
  if (!value || typeof value !== 'object') {
    return undefined
  }
  if ('componentId' in value && value.componentId === componentId) {
    return value as A2uiNode
  }
  for (const item of Object.values(value)) {
    const found = find(item, componentId)
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

  let basicViews: A2uiSurfaceView[] = []
  const basicSession = createA2uiSession({
    catalog: demoCatalog,
    onSurfaces(next) {
      basicViews = next
    },
    onAction: () => {},
  })
  for (const message of basicMessages) {
    basicSession.receive(message)
  }
  const nestedLabel = find(basicViews.find(view => view.id === BASIC_SURFACE_ID)?.root, 'label')?.props.text
  basicSession.dispose()
  return { reason, nestedLabel }
}
