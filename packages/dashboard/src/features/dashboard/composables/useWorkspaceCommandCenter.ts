import type { DashboardValueOption, WorkspaceCommandCategory, WorkspaceCommandItem } from '../types'
import { computed, onBeforeUnmount, ref, watch } from 'vue'
import { copyText } from '../utils/clipboard'

export type CommandCategoryFilter = 'all' | WorkspaceCommandCategory

export const commandCategoryLabels: Record<WorkspaceCommandCategory, string> = {
  dev: '开发',
  build: '构建',
  analyze: '分析',
}

export const commandCategoryTones: Record<WorkspaceCommandCategory, 'info' | 'success' | 'warning'> = {
  dev: 'info',
  build: 'success',
  analyze: 'warning',
}

const categoryOptions: DashboardValueOption<CommandCategoryFilter>[] = [
  { value: 'all', label: '全部命令' },
  { value: 'dev', label: commandCategoryLabels.dev },
  { value: 'build', label: commandCategoryLabels.build },
  { value: 'analyze', label: commandCategoryLabels.analyze },
]

interface WorkspaceCommandCenterProps {
  commands: WorkspaceCommandItem[]
}

export function useWorkspaceCommandCenter(props: WorkspaceCommandCenterProps) {
  const searchQuery = ref('')
  const categoryFilter = ref<CommandCategoryFilter>('all')
  const selectedCommandValue = ref<string | null>(null)
  const copiedCommand = ref<string | null>(null)
  const failedCommand = ref<string | null>(null)
  let copyFeedbackTimer: ReturnType<typeof setTimeout> | null = null

  const filteredCommands = computed(() => {
    const keyword = searchQuery.value.trim().toLowerCase()

    return props.commands.filter((command) => {
      if (categoryFilter.value !== 'all' && command.category !== categoryFilter.value) {
        return false
      }
      if (!keyword) {
        return true
      }
      return [
        command.label,
        command.command,
        command.note,
        commandCategoryLabels[command.category],
      ].join(' ').toLowerCase().includes(keyword)
    })
  })

  const selectedCommand = computed(() =>
    filteredCommands.value.find(command => command.command === selectedCommandValue.value)
    ?? filteredCommands.value[0]
    ?? null,
  )

  const commandSummary = computed(() => {
    const totalCount = props.commands.length
    const filteredCount = filteredCommands.value.length
    const categoryText = categoryFilter.value === 'all'
      ? '全部'
      : commandCategoryLabels[categoryFilter.value]

    return `匹配 ${filteredCount} / ${totalCount} 条 · ${categoryText}`
  })

  function clearCopyFeedback() {
    copiedCommand.value = null
    failedCommand.value = null
  }

  function scheduleCopyFeedbackClear() {
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer)
    }

    copyFeedbackTimer = setTimeout(() => {
      clearCopyFeedback()
      copyFeedbackTimer = null
    }, 1800)
  }

  async function copyCommand(command: string) {
    try {
      await copyText(command)
      copiedCommand.value = command
      failedCommand.value = null
    }
    catch {
      copiedCommand.value = null
      failedCommand.value = command
    }

    scheduleCopyFeedbackClear()
  }

  watch(filteredCommands, (commands) => {
    if (!commands.some(command => command.command === selectedCommandValue.value)) {
      selectedCommandValue.value = commands[0]?.command ?? null
    }
  }, { immediate: true })

  onBeforeUnmount(() => {
    if (copyFeedbackTimer) {
      clearTimeout(copyFeedbackTimer)
    }
  })

  return {
    categoryFilter,
    categoryLabels: commandCategoryLabels,
    categoryOptions,
    categoryTones: commandCategoryTones,
    commandSummary,
    copiedCommand,
    copyCommand,
    failedCommand,
    filteredCommands,
    searchQuery,
    selectedCommand,
    selectedCommandValue,
  }
}
