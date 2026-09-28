import type { TreemapNodeMeta } from '../types'
import type { TreemapDetailReport } from '../utils/treemapDetails/context'
import type { TreemapImportIndex } from '../utils/treemapDetails/references'
import { computed, reactive, watch } from 'vue'
import { createTreemapDetailSignatures } from '../utils/treemapDetails/signatures'

interface DetailSectionState {
  open: boolean
  unread: boolean
  signature: string | undefined
}

/**
 * 仅保留当前节点的分组状态，报告重建不重置折叠，展开才确认已读。
 * 复用详情面板按完整报告缓存的索引；引用索引保持惰性，不受图表筛选影响。
 */
export function useTreemapDetailSections(options: {
  report: () => TreemapDetailReport
  imports: () => TreemapImportIndex
  selectedMeta: () => TreemapNodeMeta | null
}) {
  const identity = computed(() => options.selectedMeta()?.nodeId ?? null)
  const states = reactive(new Map<string, DetailSectionState>())

  watch([options.report, identity], ([currentReport, currentIdentity], previous) => {
    if (currentIdentity !== previous[1]) {
      states.clear()
    }
    const signatures = createTreemapDetailSignatures(currentReport, options.selectedMeta(), options.imports)
    for (const [id, state] of states) {
      const signature = signatures.get(id)
      if (!state.open && signature !== state.signature) {
        state.unread = true
      }
      // 分组消失也属于内容变化，重现或恢复旧内容不能代替用户确认已读。
      state.signature = signature
    }
    for (const [id, signature] of signatures) {
      if (!states.has(id)) {
        states.set(id, { open: true, unread: false, signature })
      }
    }
  }, { immediate: true })

  return {
    isOpen: (id: string) => states.get(id)?.open ?? true,
    hasUnread: (id: string) => states.get(id)?.unread ?? false,
    setOpen(id: string, open: boolean) {
      const state = states.get(id)
      if (state) {
        state.open = open
        if (open) {
          state.unread = false
        }
      }
    },
  }
}
