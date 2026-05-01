import type { Ref, ShallowRef } from 'vue'
import { computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { copyText } from '../utils/clipboard'

export function createAnalyzeViewUrl(fullPath: string) {
  return new URL(fullPath, window.location.origin).toString()
}

export function useAnalyzeViewActions(options: {
  exportStatus: ShallowRef<string>
  moreMenuOpen: Ref<boolean>
  resetPageSelection: () => void
  resetTreemapSelection: () => void
}) {
  const route = useRoute()
  const router = useRouter()

  const canResetView = computed(() => route.fullPath !== '/analyze')

  async function copyViewLink() {
    await copyText(createAnalyzeViewUrl(route.fullPath))
    options.exportStatus.value = '视图链接已复制'
    options.moreMenuOpen.value = false
  }

  async function resetAnalyzeView() {
    options.resetTreemapSelection()
    options.resetPageSelection()
    options.moreMenuOpen.value = false
    await router.replace({ path: '/analyze', query: {} })
    options.exportStatus.value = '已重置视图'
  }

  return {
    canResetView,
    copyViewLink,
    resetAnalyzeView,
  }
}
