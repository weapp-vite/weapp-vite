import { getCurrentInstance } from 'wevu'

export function useIssue317Toast(scope: string) {
  const instance = getCurrentInstance()
  const normalizedScope = scope.toUpperCase()

  function showToast(message: string) {
    return `${normalizedScope}:${message}:${instance ? 'instance' : 'none'}`
  }

  return {
    showToast,
  }
}
