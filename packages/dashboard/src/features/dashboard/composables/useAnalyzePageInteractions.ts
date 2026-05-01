import type { Ref, ShallowRef } from 'vue'
import type {
  AnalyzeActionCenterItem,
  AnalyzeCommandPaletteItem,
  AnalyzeTreemapFilterMode,
  AnalyzeWorkQueueItem,
  DashboardTab,
  LargestFileEntry,
  PackageBudgetWarning,
  TreemapNodeMeta,
} from '../types'
import type { PrReviewChecklistItem } from '../utils/prReviewChecklist'
import { shallowRef } from 'vue'
import { createActionWorkQueueItem } from '../utils/workQueue'

export function useAnalyzePageInteractions(options: {
  activeTab: Ref<DashboardTab>
  actionItems: Ref<AnalyzeActionCenterItem[]>
  workQueueItems: Ref<AnalyzeWorkQueueItem[]>
  addWorkQueueItem: (item: AnalyzeWorkQueueItem) => void
  exportStatus: Ref<string>
  treemapFilterMode: Ref<AnalyzeTreemapFilterMode>
  selectedTreemapMeta: ShallowRef<TreemapNodeMeta | null>
  selectedLargestFile: ShallowRef<LargestFileEntry | null>
  selectedBudgetWarning: ShallowRef<PackageBudgetWarning | null>
  handleSelectBudgetWarning: (warning: PackageBudgetWarning) => void
  handleSelectLargestFile: (file: LargestFileEntry) => void
}) {
  const selectedActionKey = shallowRef<string | null>(null)
  const commandPaletteOpen = shallowRef(false)
  const activeWorkQueueItemId = shallowRef<string | null>(null)

  function resetPageSelection() {
    selectedActionKey.value = null
    activeWorkQueueItemId.value = null
  }

  function resetTreemapLinkedSelection() {
    options.selectedLargestFile.value = null
    options.selectedBudgetWarning.value = null
  }

  function handleSelectAction(item: AnalyzeActionCenterItem) {
    selectedActionKey.value = item.key
    if (item.kind === 'increment') {
      options.treemapFilterMode.value = 'growth'
    }
    else if (item.kind === 'duplicate') {
      options.treemapFilterMode.value = 'duplicates'
    }

    if (item.warning) {
      options.activeTab.value = 'files'
      options.handleSelectBudgetWarning(item.warning)
      options.treemapFilterMode.value = 'selected-package'
      return
    }

    if (item.file) {
      options.activeTab.value = 'files'
      options.handleSelectLargestFile(item.file)
      options.treemapFilterMode.value = 'selected-package'
      return
    }

    if (item.moduleMeta) {
      options.activeTab.value = item.tab
      options.selectedTreemapMeta.value = item.moduleMeta
      resetTreemapLinkedSelection()
      return
    }

    options.activeTab.value = item.tab
  }

  function handleSelectCommand(item: AnalyzeCommandPaletteItem) {
    if (item.action) {
      handleSelectAction(item.action)
      return
    }

    if (item.warning) {
      options.activeTab.value = 'files'
      options.handleSelectBudgetWarning(item.warning)
      options.treemapFilterMode.value = 'selected-package'
      return
    }

    if (item.file) {
      options.activeTab.value = 'files'
      options.handleSelectLargestFile(item.file)
      options.treemapFilterMode.value = 'selected-package'
      return
    }

    if (item.moduleMeta) {
      options.activeTab.value = item.tab
      options.selectedTreemapMeta.value = item.moduleMeta
      resetTreemapLinkedSelection()
      options.treemapFilterMode.value = item.kind === 'increment' ? 'growth' : 'duplicates'
      return
    }

    if (item.packageMeta) {
      options.activeTab.value = item.tab
      options.selectedTreemapMeta.value = item.packageMeta
      resetTreemapLinkedSelection()
      options.treemapFilterMode.value = 'selected-package'
      return
    }

    options.activeTab.value = item.tab
  }

  function handleAddActionToWorkQueue(item: AnalyzeActionCenterItem) {
    options.addWorkQueueItem(createActionWorkQueueItem(item))
    options.exportStatus.value = '已加入清单'
  }

  function handleSelectWorkQueueItem(item: AnalyzeWorkQueueItem) {
    activeWorkQueueItemId.value = item.id

    if (item.targetKind === 'action') {
      const action = options.actionItems.value.find(candidate => candidate.key === item.targetKey)
      if (action) {
        handleSelectAction(action)
        return
      }
    }

    options.activeTab.value = item.tab
  }

  function handleSelectReviewChecklistItem(item: PrReviewChecklistItem) {
    if (item.actionKey) {
      const action = options.actionItems.value.find(candidate => candidate.key === item.actionKey)
      if (action) {
        handleSelectAction(action)
        return
      }
    }

    if (item.workQueueItemId) {
      const workQueueItem = options.workQueueItems.value.find(candidate => candidate.id === item.workQueueItemId)
      if (workQueueItem) {
        handleSelectWorkQueueItem(workQueueItem)
        return
      }
    }

    options.activeTab.value = item.tab
  }

  return {
    activeWorkQueueItemId,
    commandPaletteOpen,
    selectedActionKey,
    handleAddActionToWorkQueue,
    handleSelectAction,
    handleSelectCommand,
    handleSelectReviewChecklistItem,
    handleSelectWorkQueueItem,
    resetPageSelection,
  }
}
