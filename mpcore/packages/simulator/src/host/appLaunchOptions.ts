import type { HeadlessWxLaunchOptions } from './wx/core'

/** 普通启动没有来源小程序，保留宿主返回的空 referrerInfo。 */
export function createAppLaunchOptions(pathname: string, query: Record<string, string>): HeadlessWxLaunchOptions {
  return {
    path: pathname.replace(/^\/+/, ''),
    query: { ...query },
    referrerInfo: {},
    scene: 1001,
  }
}

/** 复制启动快照，保留真实 scene 与来源字段的存在性，不向缺失字段填充默认值。 */
export function cloneAppLaunchOptions(options: HeadlessWxLaunchOptions): HeadlessWxLaunchOptions {
  const referrerInfo = { ...options.referrerInfo }
  if (referrerInfo.extraData !== undefined) {
    referrerInfo.extraData = { ...referrerInfo.extraData }
  }
  return { ...options, query: { ...options.query }, referrerInfo }
}
