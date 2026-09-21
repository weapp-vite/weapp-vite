import type { InternalRuntimeState } from '../../types'
import { WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY } from '@weapp-core/constants'
import { getMiniProgramRuntimeGlobalObject, resolveCurrentMiniProgramPlatform } from '../../platform'

function createAlipayPageDefinition(componentDefinition: Record<string, any>) {
  const {
    lifetimes = {},
    methods = {},
    observers: _observers,
    options: _options,
    pageLifetimes = {},
    properties: _properties,
    ...pageDefinition
  } = componentDefinition

  const pageOnLoad = pageDefinition.onLoad

  return {
    ...pageDefinition,
    ...methods,
    onLoad(this: InternalRuntimeState, ...args: any[]) {
      // 支付宝 Page 不提供微信的 options 字段，在挂载前统一页面参数契约，
      // 避免 setup 读不到 query 或后续 onShow/onReady 将其清空。
      ;(this as Record<string, any>).options = args[0] && typeof args[0] === 'object' ? args[0] : {}
      lifetimes.created?.apply(this, args)
      const result = pageOnLoad?.apply(this, args)
      lifetimes.attached?.apply(this, args)
      return result
    },
    onShow(this: InternalRuntimeState, ...args: any[]) {
      return pageLifetimes.show?.apply(this, args)
    },
    onReady(this: InternalRuntimeState, ...args: any[]) {
      return lifetimes.ready?.apply(this, args)
    },
    onHide(this: InternalRuntimeState, ...args: any[]) {
      return pageLifetimes.hide?.apply(this, args)
    },
    onResize(this: InternalRuntimeState, ...args: any[]) {
      return pageLifetimes.resize?.apply(this, args)
    },
    onUnload(this: InternalRuntimeState, ...args: any[]) {
      return lifetimes.detached?.apply(this, args)
    },
    onError(this: InternalRuntimeState, ...args: any[]) {
      return lifetimes.error?.apply(this, args)
    },
  }
}

/**
 * 根据当前宿主注册 wevu 原生定义。
 * 支付宝不支持使用 Component() 注册普通页面，需要转换为 Page() 契约。
 */
export function registerNativeComponentDefinition(
  componentDefinition: Record<string, any>,
  isPage: boolean,
) {
  const statefulHmrBridge = getMiniProgramRuntimeGlobalObject()?.[WEAPP_VITE_STATEFUL_HMR_BRIDGE_KEY]
  if (isPage && resolveCurrentMiniProgramPlatform() === 'alipay') {
    const pageDefinition = createAlipayPageDefinition(componentDefinition)
    if (typeof statefulHmrBridge?.Page === 'function') {
      statefulHmrBridge.Page(pageDefinition)
      return
    }
    Page(pageDefinition)
    return
  }
  if (typeof statefulHmrBridge?.Component === 'function') {
    statefulHmrBridge.Component(componentDefinition)
    return
  }
  Component(componentDefinition)
}
