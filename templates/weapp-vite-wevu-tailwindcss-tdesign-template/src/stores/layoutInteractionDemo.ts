import { computed, defineStore, ref } from 'wevu'

export type LayoutKind = 'default' | 'admin'
export type LayoutCommandType = 'toast' | 'alert' | 'confirm'
export type LayoutCommandStatus = 'idle' | 'running'

export interface LayoutCommand {
  id: number
  title: string
  content: string
  type: LayoutCommandType
}

function createLog(message: string) {
  return `${new Date().toLocaleTimeString()} ${message}`
}

export const useLayoutInteractionDemoStore = defineStore('layout-interaction-demo', () => {
  const activeLayout = ref<LayoutKind>('default')
  const commandSeed = ref(0)
  const commandStatus = ref<LayoutCommandStatus>('idle')
  const pendingCommand = ref<LayoutCommand | null>(null)
  const lastResult = ref('尚未触发交互')
  const logs = ref<string[]>([
    createLog('Store 已就绪，等待通过页面上下文调用 layout 宿主。'),
  ])

  const adminLayoutProps = computed(() => ({
    title: 'Store Admin Layout',
    subtitle: `当前通过 wevu/store 驱动，最近动作：${lastResult.value}`,
  }))

  function appendLog(message: string) {
    logs.value = [createLog(message), ...logs.value].slice(0, 8)
  }

  function setLayout(layout: LayoutKind) {
    activeLayout.value = layout
    appendLog(`切换到 ${layout} 布局`)
  }

  function queueCommand(type: LayoutCommandType, title: string, content: string) {
    commandSeed.value += 1
    pendingCommand.value = {
      id: commandSeed.value,
      type,
      title,
      content,
    }
    commandStatus.value = 'running'
    appendLog(`Store 请求 ${title}`)
  }

  function triggerToast() {
    queueCommand('toast', `Store Toast #${commandSeed.value + 1}`, `当前由 ${activeLayout.value} layout 宿主展示 toast。`)
  }

  function triggerAlert() {
    queueCommand('alert', `Store Alert #${commandSeed.value + 1}`, `当前由 ${activeLayout.value} layout 宿主展示 alert。`)
  }

  function triggerConfirm() {
    queueCommand('confirm', `Store Confirm #${commandSeed.value + 1}`, `请确认由 ${activeLayout.value} layout 宿主承载的确认弹窗。`)
  }

  function finishCommand(message: string) {
    lastResult.value = message
    commandStatus.value = 'idle'
    pendingCommand.value = null
    appendLog(message)
  }

  function resetLogs() {
    logs.value = [createLog('已清空日志，继续观察 store 与 layout 的通信。')]
    lastResult.value = '日志已清空'
  }

  return {
    activeLayout,
    adminLayoutProps,
    commandStatus,
    lastResult,
    logs,
    pendingCommand,
    finishCommand,
    resetLogs,
    setLayout,
    triggerAlert,
    triggerConfirm,
    triggerToast,
  }
})
