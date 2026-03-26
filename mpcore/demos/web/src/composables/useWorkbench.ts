import { computed, onMounted, ref } from 'vue'
import { useWorkbenchDebug } from '../lib/workbenchDebug'
import { builtInScenarios } from '../scenarios'
import { useWorkbenchFiles } from './useWorkbenchFiles'
import { useWorkbenchSession } from './useWorkbenchSession'
import { useWorkbenchTheme } from './useWorkbenchTheme'

export function useWorkbench() {
  const explorerTab = ref<'resources' | 'scenarios' | 'runtime'>('resources')
  const debugTab = ref<'wxml' | 'console' | 'appData' | 'sources' | 'network' | 'performance'>('console')
  const viewportSize = ref({ height: 812, width: 375 })

  const theme = useWorkbenchTheme()
  const sessionState = useWorkbenchSession(viewportSize)
  const files = useWorkbenchFiles(sessionState.fileEntries, sessionState.currentRoute)
  const debug = useWorkbenchDebug(
    sessionState.currentRoute,
    sessionState.pageStack,
    sessionState.previewMarkup,
    sessionState.requestLogData,
    sessionState.selectedScope,
    sessionState.storageData,
    viewportSize,
  )

  const projectDisplayLabel = computed(() => sessionState.projectLabel.value || 'weapp-vite-wevu-template')

  async function handleDirectoryChange(event: Event) {
    files.resetFiles()
    await sessionState.handleDirectoryChange(event)
  }

  function handlePickScenario(scenarioId: string) {
    files.resetFiles()
    sessionState.handlePickScenario(scenarioId)
  }

  onMounted(() => {
    const firstScenario = builtInScenarios[0]
    if (!sessionState.session.value && firstScenario) {
      files.resetFiles()
      sessionState.loadSession(firstScenario.name, firstScenario.files, firstScenario.id)
    }
  })

  return {
    ...debug,
    ...files,
    ...sessionState,
    ...theme,
    builtInScenarios,
    debugTab,
    explorerTab,
    handleDirectoryChange,
    handlePickScenario,
    projectDisplayLabel,
    viewportSize,
  }
}
