import {
  setTabBarBadgeState,
  setTabBarRedDotState,
  setTabBarVisible,
  updateTabBarItem,
  updateTabBarStyle,
} from '../appShell/tabBar'
import {
  callMiniProgramAsyncFailure,
  callMiniProgramAsyncSuccess,
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
  return Promise.resolve(callMiniProgramAsyncSuccess(options, {
    errMsg: 'getNetworkType:ok',
    ...status,
  }))
}

function resolveTabBarMutation(action: string, options: any, succeeded: boolean, failureReason = 'tabBar not configured') {
  if (succeeded) {
    return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: `${action}:ok` }))
  }
  const failure = callMiniProgramAsyncFailure(options, `${action}:fail ${failureReason}`)
  return Promise.reject(failure)
}

export function showTabBarBridge(options?: any): Promise<any> {
  return resolveTabBarMutation('showTabBar', options, setTabBarVisible(true, options?.animation === true))
}

export function hideTabBarBridge(options?: any): Promise<any> {
  return resolveTabBarMutation('hideTabBar', options, setTabBarVisible(false, options?.animation === true))
}

export function setTabBarItemBridge(options?: any): Promise<any> {
  const patch = {
    ...(typeof options?.text === 'string' ? { text: options.text } : {}),
    ...(typeof options?.iconPath === 'string' ? { iconPath: options.iconPath } : {}),
    ...(typeof options?.selectedIconPath === 'string' ? { selectedIconPath: options.selectedIconPath } : {}),
  }
  return resolveTabBarMutation('setTabBarItem', options, updateTabBarItem(options?.index, patch), 'invalid index')
}

export function setTabBarStyleBridge(options?: any): Promise<any> {
  const patch = {
    ...(typeof options?.color === 'string' ? { color: options.color } : {}),
    ...(typeof options?.selectedColor === 'string' ? { selectedColor: options.selectedColor } : {}),
    ...(typeof options?.backgroundColor === 'string' ? { backgroundColor: options.backgroundColor } : {}),
    ...(options?.borderStyle === 'black' || options?.borderStyle === 'white'
      ? { borderStyle: options.borderStyle }
      : {}),
  }
  return resolveTabBarMutation('setTabBarStyle', options, updateTabBarStyle(patch))
}

export function setTabBarBadgeBridge(options?: any): Promise<any> {
  const succeeded = typeof options?.text === 'string'
    && setTabBarBadgeState(options?.index, options.text)
  return resolveTabBarMutation('setTabBarBadge', options, succeeded, 'invalid index or text')
}

export function removeTabBarBadgeBridge(options?: any): Promise<any> {
  return resolveTabBarMutation(
    'removeTabBarBadge',
    options,
    setTabBarBadgeState(options?.index, undefined),
    'invalid index',
  )
}

export function showTabBarRedDotBridge(options?: any): Promise<any> {
  return resolveTabBarMutation('showTabBarRedDot', options, setTabBarRedDotState(options?.index, true), 'invalid index')
}

export function hideTabBarRedDotBridge(options?: any): Promise<any> {
  return resolveTabBarMutation('hideTabBarRedDot', options, setTabBarRedDotState(options?.index, false), 'invalid index')
}

export function requestPaymentBridge(options?: any): Promise<any> {
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'requestPayment:ok' }))
}

export function requestSubscribeMessageBridge(options?: any): Promise<any> {
  const tmplIds = normalizeSubscribeTemplateIds(options?.tmplIds)
  if (tmplIds.length === 0) {
    const failure = callMiniProgramAsyncFailure(options, 'requestSubscribeMessage:fail invalid tmplIds')
    return Promise.reject(failure)
  }
  const decisionMap = resolveSubscribeDecisionMap(tmplIds)
  const result: Record<string, any> & { errMsg: string } = tmplIds.reduce<Record<string, any> & { errMsg: string }>((payload, tmplId) => {
    payload[tmplId] = decisionMap[tmplId]
    return payload
  }, { errMsg: 'requestSubscribeMessage:ok' })
  return Promise.resolve(callMiniProgramAsyncSuccess(options, result))
}

export function showModalBridge(options?: any): Promise<any> {
  const modalResult = resolveModalSelection(options)
  const result = {
    errMsg: 'showModal:ok',
    confirm: modalResult.confirm,
    cancel: modalResult.cancel,
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, result))
}

export function showActionSheetBridge(options?: any): Promise<any> {
  const itemList = normalizeActionSheetItems(options?.itemList)
  if (!itemList.length) {
    const failure = callMiniProgramAsyncFailure(options, 'showActionSheet:fail invalid itemList')
    return Promise.reject(failure)
  }
  const tapIndex = resolveActionSheetSelection(itemList)
  if (tapIndex === null) {
    const failure = callMiniProgramAsyncFailure(options, 'showActionSheet:fail cancel')
    return Promise.reject(failure)
  }
  return Promise.resolve(callMiniProgramAsyncSuccess(options, {
    errMsg: 'showActionSheet:ok',
    tapIndex,
  }))
}

export function showShareMenuBridge(options?: any): Promise<any> {
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'showShareMenu:ok' }))
}

export function updateShareMenuBridge(options?: any): Promise<any> {
  return Promise.resolve(callMiniProgramAsyncSuccess(options, { errMsg: 'updateShareMenu:ok' }))
}
