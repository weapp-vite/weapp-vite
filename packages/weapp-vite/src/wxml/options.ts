import type { EnhanceOptions, WxmlRemoveOptions } from '../types'

/** 未配置时维持历史注释清理；显式配置只启用所选能力。 */
export function resolveWxmlRemoveOptions(wxml: EnhanceOptions['wxml']): WxmlRemoveOptions {
  const remove = typeof wxml === 'object' ? wxml.remove : undefined
  if (remove === undefined) {
    return { comment: true }
  }
  if (remove === true) {
    return {
      attr: ['data-testid', 'data-test', 'data-cy', 'data-qa'],
      comment: true,
    }
  }
  return remove === false ? {} : remove
}
