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
  setTreemapFilterMode: (mode: AnalyzeTreemapFilterMode, tab?: DashboardTab) => Promise<unknown>
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

  function handleOpenFile(file: LargestFileEntry) {
    options.selectedBudgetWarning.value = null
    options.handleSelectLargestFile(file)
    void options.setTreemapFilterMode('selected-package', 'files')
  }

  function handleFocusAction(item: AnalyzeActionCenterItem) {
    selectedActionKey.value = item.key
  }

  function handleSelectAction(item: AnalyzeActionCenterItem) {
    selectedActionKey.value = item.key
    if (item.warning) {
      options.handleSelectBudgetWarning(item.warning)
      return
    }

    if (item.file) {
      handleOpenFile(item.file)
      return
    }

    if (item.moduleMeta) {
      options.selectedTreemapMeta.value = item.moduleMeta
      resetTreemapLinkedSelection()
    }

    if (item.kind === 'increment' || item.kind === 'duplicate') {
      void options.setTreemapFilterMode(item.kind === 'increment' ? 'growth' : 'duplicates', item.tab)
    }
    else {
      options.activeTab.value = item.tab
    }
  }

  function handleSelectCommand(item: AnalyzeCommandPaletteItem) {
    if (item.action) {
      handleSelectAction(item.action)
      return
    }

    if (item.warning) {
      options.handleSelectBudgetWarning(item.warning)
      return
    }

    if (item.file) {
      handleOpenFile(item.file)
      return
    }

    if (item.moduleMeta) {
      options.selectedTreemapMeta.value = item.moduleMeta
      resetTreemapLinkedSelection()
      void options.setTreemapFilterMode(item.kind === 'increment' ? 'growth' : 'duplicates', item.tab)
      return
    }

    if (item.packageMeta) {
      options.selectedTreemapMeta.value = item.packageMeta
      resetTreemapLinkedSelection()
      void options.setTreemapFilterMode('selected-package', item.tab)
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
    handleFocusAction,
    handleOpenFile,
    handleSelectAction,
    handleSelectCommand,
    handleSelectReviewChecklistItem,
    handleSelectWorkQueueItem,
    resetPageSelection,
  }
}
