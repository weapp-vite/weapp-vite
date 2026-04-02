import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import {
  readClipboardData,
  resolveScanCodeResult,
  writeClipboardData,
} from './interaction'
import { getGlobalDialogHandlers } from './ui'

export function openCustomerServiceChatBridge(options?: any) {
  const url = options?.url?.trim() ?? ''
  if (url && typeof window !== 'undefined' && typeof window.open === 'function') {
    try {
      window.open(url, '_blank', 'noopener,noreferrer')
    }
    catch {
      // ignore browser popup restrictions
    }
  }
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'openCustomerServiceChat:ok' }))
}

export function scanCodeBridge(options?: any) {
  const { prompt } = getGlobalDialogHandlers()
  const resultText = resolveScanCodeResult(prompt)
  if (resultText == null) {
    const failure = callWxAsyncFailure(options, 'scanCode:fail cancel')
    return Promise.reject(failure)
  }
  const result = callWxAsyncSuccess(options, {
    errMsg: 'scanCode:ok',
    result: resultText,
    scanType: 'QR_CODE',
    charSet: 'utf-8',
    path: resultText,
    rawData: resultText,
  })
  return Promise.resolve(result)
}

export async function setClipboardDataBridge(options?: any) {
  const data = String(options?.data ?? '')
  try {
    await writeClipboardData(data)
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `setClipboardData:fail ${message}`)
    return Promise.reject(failure)
  }
  return callWxAsyncSuccess(options, { errMsg: 'setClipboardData:ok' })
}

export async function getClipboardDataBridge(options?: any) {
  try {
    const data = await readClipboardData()
    return callWxAsyncSuccess(options, { errMsg: 'getClipboardData:ok', data })
  }
  catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const failure = callWxAsyncFailure(options, `getClipboardData:fail ${message}`)
    return Promise.reject(failure)
  }
}
