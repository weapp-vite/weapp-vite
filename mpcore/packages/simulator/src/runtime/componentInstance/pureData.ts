import type { HeadlessComponentDefinition, HeadlessComponentInstance } from './types'

/** 原生纯数据保留在逻辑层，不能参与组件自身的模板求值。 */
export function isPureDataField(definition: HeadlessComponentDefinition | undefined, key: string) {
  const pattern = definition?.options?.pureDataPattern
  // 组件脚本可能在独立 VM realm 中执行，不能用 instanceof 判定正则。
  return typeof pattern?.source === 'string' && typeof pattern?.flags === 'string'
    && new RegExp(pattern.source, pattern.flags).test(key)
}

/** Node 与浏览器渲染共享同一纯数据边界。 */
export function resolveComponentViewData(instance: HeadlessComponentInstance) {
  return Object.fromEntries(Object.entries(instance.data).filter(([key]) => !isPureDataField(instance.__definition__, key)))
}
