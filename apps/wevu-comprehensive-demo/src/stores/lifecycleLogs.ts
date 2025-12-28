import { ref } from 'wevu'

export type LifecycleScope = 'app' | 'page' | 'component' | 'alias'

export const lifecycleLogs = ref<string[]>([])

function formatLog(hook: string, scope: LifecycleScope, detail?: string) {
  const timestamp = new Date().toLocaleTimeString()
  const suffix = detail ? ` - ${detail}` : ''
  return `${timestamp} [${scope}] ${hook}${suffix}`
}

export function pushLifecycleLog(hook: string, scope: LifecycleScope, detail?: string) {
  lifecycleLogs.value = [formatLog(hook, scope, detail), ...lifecycleLogs.value].slice(0, 200)
}

export function clearLifecycleLogs() {
  lifecycleLogs.value = []
}

export function useLifecycleLogs() {
  return {
    lifecycleLogs,
    pushLifecycleLog,
    clearLifecycleLogs,
  }
}
