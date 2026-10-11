import type { Ref } from 'vue'
import type { DashboardInvestigationTarget } from 'weapp-vite/dashboard'
import type { AnalyzeSubpackagesResult, DashboardTab, LargestFileEntry, TreemapNodeMeta } from '../types'
import { shallowRef } from 'vue'
import { createTreemapModuleNodeId } from '../utils/treemap'

export function useObjectInspectionNavigation(options: {
  resultRef: Ref<AnalyzeSubpackagesResult | null>
  activeTab: Ref<DashboardTab>
}) {
  const inspectionTarget = shallowRef<DashboardInvestigationTarget | null>(null)
  const inspectionSourcePath = shallowRef<string | null>(null)
  const investigationRequest = shallowRef<DashboardInvestigationTarget | null>(null)
  const investigationRequestId = shallowRef(0)

  function containsTarget(target: DashboardInvestigationTarget) {
    const report = options.resultRef.value
    if (target.kind === 'module' && report?.modules.some(module => module.id === target.moduleId
      && module.packages.some(placement => placement.packageId === target.packageId && placement.files.includes(target.file)))) {
      return true
    }
    const pkg = report?.packages.find(item => item.id === target.packageId)
    if (!pkg) {
      return false
    }
    if (target.kind === 'package') {
      return true
    }
    const file = pkg.files.find(item => item.file === target.file)
    if (!file) {
      return false
    }
    return target.kind === 'artifact'
      || Boolean(file.modules?.some(module => module.id === target.moduleId))
  }

  function handleSelectInspectionTarget(target: DashboardInvestigationTarget) {
    if (!containsTarget(target)) {
      return
    }
    inspectionTarget.value = { ...target }
    inspectionSourcePath.value = null
  }

  function handleOpenInspectionFile(file: LargestFileEntry) {
    const target: DashboardInvestigationTarget = { kind: 'artifact', packageId: file.packageId, file: file.file }
    if (!containsTarget(target)) {
      return
    }
    handleSelectInspectionTarget(target)
    options.activeTab.value = 'files'
  }

  function handleOpenInspectionSource(meta: TreemapNodeMeta) {
    if (meta.kind === 'package') {
      return
    }
    const pkg = options.resultRef.value?.packages.find(item => item.id === meta.packageId)
    const file = pkg?.files.find(item => item.file === meta.fileName)
    if (!file) {
      return
    }
    const module = meta.kind === 'module'
      ? file.modules?.find(item => createTreemapModuleNodeId(meta.packageId, file.file, item.id) === meta.nodeId)
      : undefined
    const source = meta.kind === 'module'
      ? module?.sourceType !== 'node_modules' ? module?.source : undefined
      : file.source ?? file.modules?.find(item => item.sourceType !== 'node_modules' && item.source)?.source
    if (!source) {
      return
    }
    inspectionTarget.value = module
      ? { kind: 'module', packageId: meta.packageId, file: file.file, moduleId: module.id }
      : { kind: 'artifact', packageId: meta.packageId, file: file.file }
    inspectionSourcePath.value = source.split('?', 1)[0]!
    options.activeTab.value = 'files'
  }

  function handleCreateObjectInvestigation(target: DashboardInvestigationTarget) {
    if (!containsTarget(target)) {
      return
    }
    if (target.kind !== 'package' && !options.resultRef.value?.packages
      .find(pkg => pkg.id === target.packageId)
      ?.files
      .some(file => file.file === target.file)) {
      return
    }
    investigationRequest.value = { ...target }
    investigationRequestId.value += 1
    options.activeTab.value = 'files'
  }

  function resetInspectionSelection() {
    inspectionTarget.value = null
    inspectionSourcePath.value = null
  }

  return {
    inspectionTarget,
    inspectionSourcePath,
    investigationRequest,
    investigationRequestId,
    handleSelectInspectionTarget,
    handleOpenInspectionFile,
    handleOpenInspectionSource,
    handleCreateObjectInvestigation,
    resetInspectionSelection,
  }
}
