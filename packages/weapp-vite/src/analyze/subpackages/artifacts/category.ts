import type { AnalyzeModuleCategory } from './types'

export function isRuntimeCategory(category: AnalyzeModuleCategory) {
  return category === 'runtime' || category === 'reactivity' || category === 'host' || category === 'helper'
}
