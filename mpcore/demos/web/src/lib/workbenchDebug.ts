import type { Ref } from 'vue'
import { computed } from 'vue'

export function useWorkbenchDebug(
  currentRoute: Ref<string>,
  pageStack: Ref<string[]>,
  previewMarkup: Ref<string>,
  requestLogData: Ref<string>,
  selectedScope: Ref<{ scopeId?: string } | null>,
  storageData: Ref<string>,
  viewportSize: Ref<{ height: number, width: number }>,
) {
  const runtimeMetrics = computed(() => [
    ['视口', `${viewportSize.value.width} × ${viewportSize.value.height}`],
    ['页面栈', String(pageStack.value.length)],
    ['请求数', String(JSON.parse(requestLogData.value).length || 0)],
    ['Storage Keys', String(Object.keys(JSON.parse(storageData.value)).length)],
  ])

  const wxmlPreviewCode = computed(() => previewMarkup.value || '<page />')
  const consoleSummary = computed(() => [
    { level: 'messages', value: '9 messages' },
    { level: 'warnings', value: '3 warnings' },
    { level: 'errors', value: 'No errors' },
  ])

  const consoleLines = computed(() => {
    const requestLogs = JSON.parse(requestLogData.value) as Array<Record<string, unknown>>
    const storage = JSON.parse(storageData.value) as Record<string, unknown>

    return [
      { level: 'system', text: `[system] Launch Time: ${Math.round(460 + previewMarkup.value.length / 8)}ms` },
      { level: 'warn', text: '[Deprecation] SharedArrayBuffer 将要求 cross-origin isolation。' },
      { level: 'info', text: `[system] Current route: /${currentRoute.value}` },
      { level: 'info', text: `[system] Storage keys: ${Object.keys(storage).length}` },
      { level: 'info', text: `[system] Mock requests: ${requestLogs.length}` },
      { level: 'debug', text: `[render] Scope selected: ${selectedScope.value?.scopeId ?? 'page-root'}` },
    ]
  })

  return {
    consoleLines,
    consoleSummary,
    runtimeMetrics,
    wxmlPreviewCode,
  }
}
