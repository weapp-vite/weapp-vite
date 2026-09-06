import type { DomCheckpoint, DomNodeExpectation, DomProvider } from '../../utils/domAcceptance/types'
import { githubText as text } from './nodes'

interface DialogState {
  id: string
  method: string
  status: string
  open: number
  settled: number
  title?: string
  content?: string
  tap?: string
}

export const MAIN_DIALOG_STEPS: DialogState[] = [
  { id: 'reset', method: '_resetE2E', status: 'idle', open: 0, settled: 0 },
  { id: 'opened', method: '_runE2E', tap: '#issue466-main-open', status: 'opening', open: 1, settled: 0, title: 'issue-466 main confirm title', content: 'issue-466 main confirm content' },
  { id: 'cancelled', method: '_cancelDialogE2E', status: 'cancelled', open: 1, settled: 1 },
  { id: 'reopened', method: '_openDialogE2E', status: 'opening', open: 2, settled: 1, title: 'issue-466 main confirm title', content: 'issue-466 main confirm content' },
  { id: 'confirmed', method: '_confirmDialogE2E', status: 'confirmed', open: 2, settled: 2 },
]

export const NATIVE_DIALOG_STEPS: DialogState[] = [
  { id: 'reset', method: '_resetE2E', status: 'idle', open: 0, settled: 0 },
  { id: 'opened', method: '_openDialogE2E', status: 'opening', open: 1, settled: 0, title: 'issue-466 native confirm title', content: 'issue-466 native confirm content' },
  { id: 'confirmed', method: '_confirmDialogE2E', status: 'confirmed', open: 1, settled: 1 },
]

export function allDialogSteps(computed = false): DialogState[] {
  const prefix = computed ? 'issue-466-computed' : 'issue-466'
  return [
    { id: 'reset', method: computed ? '_resetDialogE2E' : '_resetE2E', status: 'idle', open: 0, settled: 0 },
    { id: 'alertOpened', method: '_openAlertE2E', status: 'opening', open: 1, settled: 0, title: `${prefix} alert title`, content: `${prefix} alert content` },
    { id: 'alertConfirmed', method: '_confirmDialogE2E', status: 'alert-confirmed', open: 1, settled: 1 },
    { id: 'confirmOpened', method: '_openConfirmE2E', status: 'opening', open: 2, settled: 1, title: `${prefix} confirm title`, content: `${prefix} confirm content` },
    { id: 'cancelled', method: '_cancelDialogE2E', status: 'cancelled', open: 2, settled: 2 },
    { id: 'actionOpened', method: '_openActionE2E', status: 'opening', open: 3, settled: 2, title: `${prefix} action title`, content: `${prefix} action content` },
    { id: 'selected', method: '_selectSecondActionE2E', status: 'action-selected', open: 3, settled: 3 },
    { id: 'closePrepared', method: '_prepareCloseHostE2E', status: 'close-prepared', open: 4, settled: 3, title: `${prefix} close title`, content: '先把宿主显示出来，再调用 Dialog.close' },
    { id: 'closed', method: '_closeDialogE2E', status: 'closed', open: 4, settled: 4 },
  ]
}

export function dialogCheckpoints(route: string, host: string, states: DialogState[], provider: DomProvider): DomCheckpoint[] {
  return states.map(state => ({
    id: state.id,
    route,
    action: `${state.tap ? '点击页面按钮' : `调用 ${state.method}`} 并检查弹窗及操作状态`,
    nodes: [
      text('#issue466-status', `lastAction = ${state.status}`),
      text('#issue466-counts', `counts = open ${state.open}, settle ${state.settled}`),
      ...(state.title
        ? [
            { ...text('.t-dialog__header', state.title, [host]), ...(provider === 'devtools' ? { visible: true } : {}) },
            text('.t-dialog__body-text', state.content!, [host]),
            { selector: 'component', scope: [host], has: '.t-popup', count: 1 },
          ]
        : [{ selector: 'component', scope: [host], has: '.t-popup', count: 0 }]) as DomNodeExpectation[],
    ],
  }))
}

export async function runDialogSteps(
  page: any,
  steps: DialogState[],
  call: (method: string) => Promise<any>,
  check: (id: string) => Promise<void>,
) {
  const snapshots: Record<string, any> = {}
  for (const step of steps) {
    if (step.tap) {
      const controls = await page.$$(step.tap, { fallback: false, timeout: 5_000 })
      if (controls.length !== 1) {
        throw new Error(`Expected one dialog control: ${step.tap}`)
      }
      await controls[0].tap()
    }
    snapshots[step.id] = await call(step.method)
    await check(step.id)
  }
  return snapshots
}
