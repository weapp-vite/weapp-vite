import type { TransformState } from '../utils'
import { createPageMetaVisitors } from './pageMeta'
import { createSetupExposeVisitors } from './setupExpose'
import { createStripTypesVisitors } from './stripTypes'

export function createMacroVisitors(state: TransformState) {
  return {
    ...createSetupExposeVisitors(state),
    ...createStripTypesVisitors(state),
    ...createPageMetaVisitors(state),
  }
}
