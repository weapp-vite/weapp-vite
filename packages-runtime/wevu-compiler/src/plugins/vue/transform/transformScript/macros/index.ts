import type * as t from '@weapp-vite/ast/babelTypes'
import type { TransformState } from '../utils'
import { createAppSetupVisitors } from './appSetup'
import { createPageMetaVisitors } from './pageMeta'
import { createSetupExposeVisitors } from './setupExpose'
import { createStripTypesVisitors } from './stripTypes'

export function createMacroVisitors(program: t.Program, state: TransformState) {
  const appSetupVisitors = createAppSetupVisitors(program, state)
  const setupExposeVisitors = createSetupExposeVisitors(state)
  const stripTypesVisitors = createStripTypesVisitors(state)
  const pageMetaVisitors = createPageMetaVisitors(state)
  const mergedVisitors: Record<string, any> = {
    ...appSetupVisitors,
    ...setupExposeVisitors,
    ...stripTypesVisitors,
    ...pageMetaVisitors,
  }

  mergedVisitors.CallExpression = (path: any) => {
    appSetupVisitors.CallExpression?.(path)
    ;(setupExposeVisitors as Record<string, any>).CallExpression?.(path)
    ;(stripTypesVisitors as Record<string, any>).CallExpression?.(path)
    if (!path.removed) {
      ;(pageMetaVisitors as Record<string, any>).CallExpression?.(path)
    }
  }

  return mergedVisitors
}
