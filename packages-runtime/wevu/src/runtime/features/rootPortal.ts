import type { WevuRuntimeBindingManifestV1 } from '@weapp-core/constants'
import { ROOT_PORTAL_ENABLE_MIN_SDK_VERSION, ROOT_PORTAL_MIN_SDK_VERSION } from '@weapp-core/constants'
import { getCurrentMiniProgramGlobalObject } from '../platform'

let warned = false

function parseSdkVersion(version: string): [number, number, number] | undefined {
  const match = /^(\d+)\.(\d+)\.(\d+)(?:\D|$)/.exec(version.trim())
  if (!match) {
    return undefined
  }
  return [Number(match[1]), Number(match[2]), Number(match[3])]
}

function isVersionLowerThan(version: [number, number, number], target: string): boolean {
  const parsed = parseSdkVersion(target)
  if (!parsed) {
    return false
  }
  for (let index = 0; index < 3; index += 1) {
    if (version[index] !== parsed[index]) {
      return version[index]! < parsed[index]!
    }
  }
  return false
}

/**
 * 模板把 Vue Teleport 映射为 root-portal 后，按宿主基础库版本提示一次能力缺口。
 */
export function warnRootPortalBaseLibraryRequirement(
  manifest: WevuRuntimeBindingManifestV1 | undefined,
): void {
  if (warned || manifest?.features?.rootPortal !== true) {
    return
  }
  warned = true

  const host = getCurrentMiniProgramGlobalObject()
  const rawVersion = host?.getAppBaseInfo?.()?.SDKVersion ?? host?.getSystemInfoSync?.()?.SDKVersion
  if (typeof rawVersion !== 'string') {
    return
  }
  const version = parseSdkVersion(rawVersion)
  if (!version) {
    return
  }

  if (isVersionLowerThan(version, ROOT_PORTAL_MIN_SDK_VERSION)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[wevu] 模板已映射 root-portal，但当前基础库 ${rawVersion} 低于 ${ROOT_PORTAL_MIN_SDK_VERSION}，root-portal 不可用。`,
    )
    return
  }
  if (isVersionLowerThan(version, ROOT_PORTAL_ENABLE_MIN_SDK_VERSION)) {
    // eslint-disable-next-line no-console
    console.warn(
      `[wevu] 模板已映射 root-portal，但当前基础库 ${rawVersion} 低于 ${ROOT_PORTAL_ENABLE_MIN_SDK_VERSION}，enable 属性将被忽略。`,
    )
  }
}
