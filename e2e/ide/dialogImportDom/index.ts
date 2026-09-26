import type { DomCheckpoint, DomNodeExpectation } from '../../utils/domAcceptance/types'
import { classText, xpathClass } from '../tdesignDom'

export function dialogImportCheckpoints(kind: 'bare' | 'index'): DomCheckpoint[] {
  const route = `/pages/dialog-${kind}/index`
  const stateNodes = (action: string, open: number, settle: number, visible: boolean): DomNodeExpectation[] => [
    { selector: '#dialog-confirm-type', text: 'confirmType = function' },
    { selector: '#dialog-action', text: `lastAction = ${action}` },
    { selector: '#dialog-counts', text: `counts = open ${open}, settle ${settle}` },
    { selector: '#dialog-visible', text: `dialogVisible = ${visible}` },
    { selector: '#dialog-error', text: action === 'cancelled' ? 'lastError = {"trigger":"cancel"}' : 'lastError = none' },
    ...(visible
      ? [
          classText('t-dialog__header', `issue-dialog-${kind} confirm title`),
          classText('t-dialog__body-text', `issue-dialog-${kind} confirm content`),
          { selector: `${xpathClass('t-dialog__footer')}//button`, query: 'xpath' as const, count: 2 },
        ]
      : [{ selector: xpathClass('t-popup'), query: 'xpath' as const, count: 0 }]),
  ]
  return [
    { id: 'initial', route, action: 'launch import page', nodes: stateNodes('idle', 0, 0, false) },
    { id: 'reset', route, action: 'reset runtime state', nodes: stateNodes('idle', 0, 0, false) },
    { id: 'open', route, action: 'tap open confirm button', nodes: stateNodes('opening', 1, 0, true) },
    { id: 'cancel', route, action: 'cancel confirm dialog', nodes: stateNodes('cancelled', 1, 1, false) },
    { id: 'reopen', route, action: 'open confirm through API', nodes: stateNodes('opening', 2, 1, true) },
    { id: 'confirm', route, action: 'confirm dialog', nodes: stateNodes('confirmed', 2, 2, false) },
    { id: 'toast', route, action: 'tap toast button', nodes: [
      classText('t-toast__text', `issue-dialog-${kind} toast user-tap`),
      { selector: '#toast-count', text: 'toastCount = 1' },
      { selector: '#toast-action', text: 'lastToastAction = shown' },
    ] },
  ]
}
