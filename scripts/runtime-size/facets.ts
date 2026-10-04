import type { AnalyzeModuleCategory, AnalyzeModuleOwner } from '../../packages/weapp-vite/src/analyze/subpackages/artifacts'

/** 包内细分类仅用于诊断；不影响预算，也不把一个模块重复记入多个类别。 */
export function runtimeModuleFacet(source: string, owner: AnalyzeModuleOwner | undefined, category: AnalyzeModuleCategory) {
  const normalized = source.replaceAll('\\', '/')
  if (owner?.name === 'wevu') {
    if (/\/(?:dist\/)?(?:dev\/)?reactivity\//.test(normalized)) {
      return 'reactivity'
    }
    if (/\/runtime\/(?:platforms?|host)\//.test(normalized)) {
      return 'host-adaptation'
    }
    const optional = normalized.match(/\/(?:runtime\/)?(router|store|layout|pageLayout|scopedSlots|templateRefs|bindModel)(?:\/|\.mjs)/)?.[1]
    if (optional) {
      return `optional:${optional}`
    }
  }
  return category
}
