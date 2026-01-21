import { ref } from 'wevu'

export type StatusTone = 'ready' | 'success' | 'warning' | 'error'

function formatValue(value: unknown) {
  if (typeof value === 'string') {
    return value
  }
  try {
    return JSON.stringify(value, null, 2)
  }
  catch {
    return String(value)
  }
}

function formatError(error: unknown) {
  if (typeof error === 'string') {
    return error
  }
  if (error && typeof error === 'object') {
    const message = (error as { errMsg?: string, message?: string }).errMsg
    if (message) {
      return message
    }
    const fallback = (error as { message?: string }).message
    if (fallback) {
      return fallback
    }
  }
  return formatValue(error)
}

export function useDemoLog() {
  const statusText = ref('Ready')
  const statusTone = ref<StatusTone>('ready')
  const logText = ref('Trigger an action to see results.')

  function setStatus(text: string, tone: StatusTone = 'ready') {
    statusText.value = text
    statusTone.value = tone
  }

  function record(label: string, value: unknown) {
    logText.value = `${label}\n${formatValue(value)}`
    setStatus('Success', 'success')
  }

  function recordError(label: string, error: unknown) {
    logText.value = `${label}\n${formatError(error)}`
    setStatus('Failed', 'error')
  }

  return {
    statusText,
    statusTone,
    logText,
    setStatus,
    record,
    recordError,
  }
}
