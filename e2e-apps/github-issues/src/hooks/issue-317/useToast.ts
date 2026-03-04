import lodash from 'lodash'
import { getCurrentInstance } from 'wevu'

export function useIssue317Toast(scope: string) {
  const instance = getCurrentInstance()
  const normalizedScope = lodash.toUpper(scope)

  function showToast(message: string) {
    return `${normalizedScope}:${message}:${instance ? 'instance' : 'none'}`
  }

  return {
    showToast,
  }
}
