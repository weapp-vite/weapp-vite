import type { TransformState } from '../utils'
import { createPageMetaVisitors } from './pageMeta'
import { createSetupExposeVisitors } from './setupExpose'
import { createStripTypesVisitors } from './stripTypes'

export function createMacroVisitors(state: TransformState) {
  const setupExposeVisitors = createSetupExposeVisitors(state)
  const stripTypesVisitors = createStripTypesVisitors(state)
  const pageMetaVisitors = createPageMetaVisitors(state)

  return {
    ...setupExposeVisitors,
    ...stripTypesVisitors,
    ...pageMetaVisitors,
    CallExpression(path: any) {
      setupExposeVisitors.CallExpression?.(path)
      stripTypesVisitors.CallExpression?.(path)
      if (!path.removed) {
        pageMetaVisitors.CallExpression?.(path)
      }
    },
  }
}
