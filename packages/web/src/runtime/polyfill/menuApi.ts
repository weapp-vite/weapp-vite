import {
  callWxAsyncFailure,
  callWxAsyncSuccess,
} from './async'
import { readNetworkStatusSnapshot } from './network'
import {
  normalizeSubscribeTemplateIds,
  resolveSubscribeDecisionMap,
} from './subscribe'
import {
  normalizeActionSheetItems,
  resolveActionSheetSelection,
  resolveModalSelection,
} from './ui'

export function getNetworkTypeBridge(options?: any): Promise<any> {
  const status = readNetworkStatusSnapshot()
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'getNetworkType:ok',
    ...status,
  }))
}

export function showTabBarBridge(options?: any): Promise<any> {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'showTabBar:ok' }))
}

export function hideTabBarBridge(options?: any): Promise<any> {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'hideTabBar:ok' }))
}

export function requestPaymentBridge(options?: any): Promise<any> {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'requestPayment:ok' }))
}

export function requestSubscribeMessageBridge(options?: any): Promise<any> {
  const tmplIds = normalizeSubscribeTemplateIds(options?.tmplIds)
  if (tmplIds.length === 0) {
    const failure = callWxAsyncFailure(options, 'requestSubscribeMessage:fail invalid tmplIds')
    return Promise.reject(failure)
  }
  const decisionMap = resolveSubscribeDecisionMap(tmplIds)
  const result = tmplIds.reduce<Record<string, any>>((payload, tmplId) => {
    payload[tmplId] = decisionMap[tmplId]
    return payload
  }, { errMsg: 'requestSubscribeMessage:ok' })
  return Promise.resolve(callWxAsyncSuccess(options, result))
}

export function showModalBridge(options?: any): Promise<any> {
  const modalResult = resolveModalSelection(options)
  const result = {
    errMsg: 'showModal:ok',
    confirm: modalResult.confirm,
    cancel: modalResult.cancel,
  }
  return Promise.resolve(callWxAsyncSuccess(options, result))
}

export function showActionSheetBridge(options?: any): Promise<any> {
  const itemList = normalizeActionSheetItems(options?.itemList)
  if (!itemList.length) {
    const failure = callWxAsyncFailure(options, 'showActionSheet:fail invalid itemList')
    return Promise.reject(failure)
  }
  const tapIndex = resolveActionSheetSelection(itemList)
  if (tapIndex === null) {
    const failure = callWxAsyncFailure(options, 'showActionSheet:fail cancel')
    return Promise.reject(failure)
  }
  return Promise.resolve(callWxAsyncSuccess(options, {
    errMsg: 'showActionSheet:ok',
    tapIndex,
  }))
}

export function showShareMenuBridge(options?: any): Promise<any> {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'showShareMenu:ok' }))
}

export function updateShareMenuBridge(options?: any): Promise<any> {
  return Promise.resolve(callWxAsyncSuccess(options, { errMsg: 'updateShareMenu:ok' }))
}
