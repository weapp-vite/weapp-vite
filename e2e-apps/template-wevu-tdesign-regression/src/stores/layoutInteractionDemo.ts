import { computed, defineStore, ref } from 'wevu'
import { alertDialog, confirmDialog } from '@/hooks/useDialog'
import { showToast } from '@/hooks/useToast'

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
  const lastResult = ref('尚未触发交互')
  const logs = ref<string[]>([
    createLog('Store 已就绪，当前由 store 直接调用 layout 宿主。'),
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

  function createCommand(type: LayoutCommandType, title: string, content: string): LayoutCommand {
    commandSeed.value += 1
    return {
      id: commandSeed.value,
      type,
      title,
      content,
    }
  }

  function finishCommand(message: string) {
    lastResult.value = message
    commandStatus.value = 'idle'
    appendLog(message)
  }

  async function runCommand(command: LayoutCommand) {
    commandStatus.value = 'running'
    appendLog(`Store 请求 ${command.title}`)

    if (command.type === 'toast') {
      showToast(command.content)
      finishCommand(`${command.title} 已由 ${activeLayout.value} layout 宿主展示`)
      return
    }

    if (command.type === 'alert') {
      await alertDialog({
        title: command.title,
        content: command.content,
        confirmBtn: '知道了',
      })
      finishCommand(`${command.title} 已确认`)
      return
    }

    try {
      await confirmDialog({
        title: command.title,
        content: command.content,
        confirmBtn: '确认',
        cancelBtn: '取消',
      })
      finishCommand(`${command.title} 点击确认`)
    }
    catch {
      finishCommand(`${command.title} 点击取消`)
    }
  }

  function triggerToast() {
    return runCommand(
      createCommand('toast', `Store Toast #${commandSeed.value + 1}`, `当前由 ${activeLayout.value} layout 宿主展示 toast。`),
    )
  }

  function triggerAlert() {
    return runCommand(
      createCommand('alert', `Store Alert #${commandSeed.value + 1}`, `当前由 ${activeLayout.value} layout 宿主展示 alert。`),
    )
  }

  function triggerConfirm() {
    return runCommand(
      createCommand('confirm', `Store Confirm #${commandSeed.value + 1}`, `请确认由 ${activeLayout.value} layout 宿主承载的确认弹窗。`),
    )
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
    finishCommand,
    resetLogs,
    setLayout,
    triggerAlert,
    triggerConfirm,
    triggerToast,
  }
})
