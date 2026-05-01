import { onBeforeUnmount, ref } from 'vue'

export function useDashboardActionStatus(duration = 1800) {
  const actionStatus = ref('')
  let actionStatusTimer: ReturnType<typeof setTimeout> | null = null

  function setActionStatus(status: string) {
    actionStatus.value = status
    if (actionStatusTimer) {
      clearTimeout(actionStatusTimer)
    }
    actionStatusTimer = setTimeout(() => {
      actionStatus.value = ''
      actionStatusTimer = null
    }, duration)
  }

  onBeforeUnmount(() => {
    if (actionStatusTimer) {
      clearTimeout(actionStatusTimer)
    }
  })

  return {
    actionStatus,
    setActionStatus,
  }
}
